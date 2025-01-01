"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const projectUtils_1 = require("./lib/projectUtils");
let batSoC = 0;
let minHomeBatVal = 85;
let totalChargePower = 0;
let totalMeasuredChargeCurrent = 0;
class ChargeMaster extends utils.Adapter {
    wallboxInfoList = [];
    adapterIntervals;
    projectUtils = new projectUtils_1.ProjectUtils(this);
    constructor(options = {}) {
        super({
            ...options,
            name: "chargemaster",
        });
        this.on("ready", this.onReady.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.wallboxInfoList = [];
        this.adapterIntervals = [];
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        if (!this.config.cycleTime) {
            this.log.warn(`Cycletime not configured or zero - will be set to 10 seconds`);
            this.config.cycleTime = 10000;
        }
        this.log.info(`Cycletime set to: ${this.config.cycleTime / 1000} seconds`);
        this.subscribeStates(`Settings.*`); // this.subscribeForeignObjects('dwd.0.warning.*');
        //#region *** Verify configured foreign states chargers and amount of chargers ***
        async function stateTest(adapter, input) {
            // async function stateTest(adapter: any, input: string): Promise<boolean> {
            if (input == "") {
                return false;
            }
            try {
                const ret = await adapter.getForeignObjectAsync(input);
                if (ret == null) {
                    throw new Error(`State "${input}" does not exist.`);
                }
                else if (ret) {
                    adapter.log.debug(`Foreign state verification by getForeignObjectAsync()`);
                }
            }
            catch (error) {
                adapter.log.error(`Configured state "${input}" is not OK and throws an error: "${error}"`);
                return false;
            }
            return true;
        }
        if ((await stateTest(this, this.config.stateHomeBatSoc)) &&
            (await stateTest(this, this.config.stateHomeSolarPower)) &&
            (await stateTest(this, this.config.stateHomePowerConsumption))) {
            this.log.info(`Verified solar system states`);
        }
        else {
            void this.setState(`info.connection`, false, true);
            this.log.error(`Solar system states not correct configured or not reachable - stopping adapter`);
            await this.stop?.({ exitCode: 11, reason: `invalid config` });
            return;
        }
        for (let i = 0; i < this.config.wallBoxList.length; i++) {
            if ((await stateTest(this, this.config.wallBoxList[i].stateChargeCurrent)) &&
                (await stateTest(this, this.config.wallBoxList[i].stateChargeAllowed)) &&
                (await stateTest(this, this.config.wallBoxList[i].stateActiveChargePower)) &&
                (await stateTest(this, this.config.wallBoxList[i].stateActiveChargeAmp))) {
                this.log.info(`Charger ${i} states verified`);
            }
            else {
                void this.setState(`info.connection`, false, true);
                this.log.error(`Charger ${i} not correct configured or not reachable - stopping adapter`);
                await this.stop?.({ exitCode: 11, reason: `invalid config` });
                return;
            }
        }
        //#endregion
        //#region *** Setup configured amount of charger control objects ***
        for (let i = 0; i < this.config.wallBoxList.length; i++) {
            void this.projectUtils.checkAndSetValueBoolean(`Settings.WB_${i}.ChargeNOW`, false, `ChargeNOW enabled for wallbox ${i}`, `switch.enable`, true, true);
            void this.projectUtils.checkAndSetValueBoolean(`Settings.WB_${i}.ChargeManager`, false, `Charge Manager for wallbox ${i} enabled`, `switch.enable`, true, true);
            void this.projectUtils.checkAndSetValueNumber(`Settings.WB_${i}.ChargeCurrent`, 6, `Set chargeNOW current output for wallbox ${i}`, `A`, `level.current`, true, true);
        }
        //#endregion
        //#region *** sentry.io ping ***
        if (this.supportsFeature && this.supportsFeature("PLUGINS")) {
            const sentryInstance = this.getPluginInstance("sentry");
            const today = new Date();
            const last = await this.getStateAsync("info.LastSentryLogDay");
            if (last?.val != today.getDate()) {
                if (sentryInstance) {
                    const Sentry = sentryInstance.getSentryObject();
                    Sentry &&
                        Sentry.withScope((scope) => {
                            scope.setLevel("info");
                            scope.setTag("SentryDay", today.getDate());
                            scope.setTag("System Power", this.config.maxAmpTotal);
                            for (let i = 0; i < Math.min(this.config.wallBoxList.length, 2); i++) {
                                scope.setTag(`WallboxAmp_${i}`, this.config.wallBoxList[i].maxAmp);
                            }
                            Sentry.captureMessage("Adapter chargemaster started", "info");
                        });
                }
                void this.setState(`info.LastSentryLogDay`, {
                    val: today.getDate(),
                    ack: true,
                });
            }
        }
        //#endregion
        try {
            minHomeBatVal = await this.projectUtils.getStateValue(`Settings.Setpoint_HomeBatSoC`);
            for (let i = 0; i < this.config.wallBoxList.length; i++) {
                this.wallboxInfoList.push({
                    ID: i,
                    ChargeNOW: await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`),
                    ChargeManager: await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`),
                    ChargeCurrent: await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`),
                    ChargePower: 0,
                    MeasuredMaxChargeAmp: 0,
                    MinAmp: this.config.wallBoxList[i].minAmp,
                    MaxAmp: this.config.wallBoxList[i].maxAmp,
                    DelayOff: 0,
                    CurrentHysteresis: 3,
                    SetOptAmp: 5,
                    SetOptAllow: false,
                    SetAmp: 0,
                    SetAllow: false,
                });
            }
            void this.calcTotalPower();
        }
        catch (error) {
            void this.setState(`info.connection`, false, true);
            this.log.error(`Unhandled exception processing initial state check: ${error}`);
        }
        void this.setState(`info.connection`, true, true);
        this.log.info(`Init done, launching state machine`);
        await this.StateMachine();
    }
    /****************************************************************************************
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback */
    onUnload(callback) {
        try {
            // WiP - Object.keys(this.adapterIntervals).forEach((timeOut) => clearTimeout(timeOut));
            this.log.info(`Adapter ChargeMaster cleaned up everything...`);
            callback();
        }
        catch {
            callback();
        }
    }
    /****************************************************************************************
     * Is called if a subscribed state changes
     * @param { string } id
     * @param { ioBroker.State | null | undefined } state */
    onStateChange(id, state) {
        try {
            if (state) {
                // The state was changed
                if (!state.ack) {
                    this.log.info(`state ${id} changed to: ${state.val} (ack = ${state.ack})`);
                    //"state chargemaster.0.Settings.WB_3.ChargeNOW changed to: true (ack = false)"
                    const subId = id.substring(id.indexOf(`Settings.`));
                    if (subId === `Settings.Setpoint_HomeBatSoC`) {
                        if (typeof state.val === "number") {
                            minHomeBatVal = state.val;
                        }
                        else if (typeof state.val === "string") {
                            minHomeBatVal = parseInt(state.val);
                        }
                        void this.setState(id, minHomeBatVal, true);
                    }
                    else {
                        for (let i = 0; i < this.config.wallBoxList.length; i++) {
                            switch (subId) {
                                case `Settings.WB_${i}.ChargeNOW`:
                                    if (typeof state.val === "boolean") {
                                        this.wallboxInfoList[i].ChargeNOW = state.val;
                                        this.log.debug(`wallbox ${i} setting ChargeNOW changed to ${state.val}`);
                                        void this.setState(id, state.val, true); // set acknowledge true
                                    }
                                    else {
                                        this.log.warn(`Wrong type for wallbox ${i} setting ChargeNOW: ${state.val}`);
                                    }
                                    break;
                                case `Settings.WB_${i}.ChargeManager`:
                                    if (typeof state.val === "boolean") {
                                        this.wallboxInfoList[i].ChargeManager = state.val;
                                        this.log.debug(`wallbox ${i} setting ChargeManager changed to ${state.val}`);
                                        void this.setState(id, state.val, true); // set acknowledge true
                                    }
                                    else {
                                        this.log.warn(`Wrong type for wallbox ${i} setting ChargeManager: ${state.val}`);
                                    }
                                    break;
                                case `Settings.WB_${i}.ChargeCurrent`:
                                    if (typeof state.val === "number") {
                                        this.wallboxInfoList[i].ChargeCurrent = state.val;
                                        this.log.debug(`wallbox ${i} setting ChargeCurrent changed to ${state.val}`);
                                        void this.setState(id, state.val, true); // set acknowledge true
                                    }
                                    else {
                                        this.log.warn(`Wrong type for wallbox ${i} setting ChargeCurrent: ${state.val}`);
                                    }
                                    break;
                            }
                        }
                    }
                }
            }
            else {
                this.log.warn(`state ${id} has been deleted`);
            }
        }
        catch (error) {
            this.log.error(`Unhandled exception processing stateChange: ${error}`);
        }
    }
    /**
     * StateMachine
     * Manages the state machine for controlling the charging of wallboxes.
     * This method performs the following actions in a continuous loop:
     *
     * 1. - Wait for Cycle Time
     * 2. - Calls `calcTotalPower()` to update the total power consumption and current of all wallboxes.
     * 3. - Iterates through each wallbox in `this.wallboxInfoList` to determine its charging status based on:
     *      - **ChargeNOW:** If enabled, sets the wallbox to its current charging current (`ChargeCurrent`) and allows charging.
     *      - **ChargeManager:** If enabled, checks the state of the home battery (`batSoC`). If the battery state of charge (SoC) is sufficient (`>= minHomeBatVal`), it invokes `Charge_Manager` to handle the charging. Otherwise, it sets the wallbox to a minimal current and disallows charging until the battery SoC is sufficient.
     *      - **Default:** For wallboxes that do not have ChargeNOW or ChargeManager enabled, it sets the wallbox to a minimum current and disallows charging.
     * 4. - Calls `chargeLimiter()` to enforce the charging limits across all wallboxes.
     * 5. - Calls `chargeConfig()` to apply any configuration changes.
     *
     * This process repeats indefinitely, managing the state of the wallboxes according to the specified conditions and limits.
     */
    async StateMachine() {
        while (true) {
            await this.delay(this.config.cycleTime);
            this.log.debug(`-x-x-x-x-x-x- StateMachine cycle started -x-x-x-x-x-x-`);
            await this.calcTotalPower();
            for (const wallbox of this.wallboxInfoList) {
                if (wallbox.ChargeNOW) {
                    // Charge-NOW is enabled
                    wallbox.SetOptAmp = wallbox.ChargeCurrent; // keep active charging current!!
                    wallbox.SetOptAllow = true;
                    this.log.debug(`State machine: Wallbox ${wallbox.ID} planned for charge-now with ${wallbox.SetOptAmp}A`);
                }
                else if (wallbox.ChargeManager) {
                    // Charge-Manager is enabled for this wallbox
                    batSoC = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomeBatSoc);
                    this.log.debug(`State machine: Got external state of battery SoC: ${batSoC}%`);
                    if (batSoC >= minHomeBatVal) {
                        // SoC of home battery sufficient?
                        await this.chargeManager(wallbox.ID);
                    }
                    else {
                        // FUTURE: time of day forces emptying of home battery
                        wallbox.SetOptAmp = wallbox.MinAmp;
                        wallbox.SetOptAllow = false;
                        this.log.debug(`State machine: Wait for home battery SoC of ${minHomeBatVal}%`);
                    }
                }
                else {
                    // switch OFF; set to min. current;
                    wallbox.SetOptAmp = wallbox.MinAmp;
                    wallbox.SetOptAllow = false;
                    this.log.debug(`State machine: Wallbox ${wallbox.ID} planned for switch off`);
                }
            }
            this.chargeLimiter();
            this.chargeConfig();
        }
    }
    async chargeManager(ID) {
        const solarPower = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomeSolarPower);
        this.log.debug(`Charge Manager: Got external state of solar power: ${solarPower} W`);
        const houseConsumption = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomePowerConsumption);
        this.log.debug(`Charge Manager: Got external state of house power consumption: ${houseConsumption} W`);
        const MAX_BAT_DISCHARGE = 2000;
        const RESERVE = 100;
        const VOLTAGE = 230;
        const wallbox = this.wallboxInfoList.find(wallbox => wallbox.ID == ID);
        if (wallbox) {
            let optAmpere = Math.floor((solarPower - houseConsumption + RESERVE + (MAX_BAT_DISCHARGE / (100 - minHomeBatVal)) * (batSoC - minHomeBatVal)) / VOLTAGE);
            optAmpere = Math.min(optAmpere, wallbox.MaxAmp); // limiting to max current of single box - global will be limited later
            this.log.debug(`Charge Manager: Optimal charging current of Wallbox ${ID} would be: ${optAmpere} A`);
            if (wallbox.SetOptAmp < optAmpere) {
                wallbox.SetOptAmp++;
            }
            else if (wallbox.SetOptAmp > optAmpere) {
                wallbox.SetOptAmp--;
            }
            this.log.debug(`Charge Manager: Wallbox ${ID} blended current: ${wallbox.SetOptAmp} A; ` +
                `Solar power: ${solarPower} W; ` +
                `House consumption: ${houseConsumption} W; ` +
                `Total charger power: ${totalChargePower} W`);
            if (wallbox.SetOptAmp > wallbox.MinAmp + wallbox.CurrentHysteresis) {
                wallbox.SetOptAllow = true; // ON and current because higher than MinAmp + hysteresis
            }
            else if (wallbox.SetOptAmp < wallbox.MinAmp) {
                wallbox.DelayOff++;
                if (wallbox.DelayOff > 15) {
                    wallbox.SetOptAllow = false; // Off
                    wallbox.DelayOff = 0;
                }
            }
            this.log.debug(`Charge Manager: Wallbox ${ID} planned state: ${wallbox.SetOptAllow}`);
        }
    }
    /**
     * charge_Limiter
     * Limits the charging current for a list of wallboxes based on their settings and the total available current.
     *
     * This method performs the following actions:
     *
     * 1. **Disables Wallboxes with `SetOptAllow` set to false:**
     *    - Iterates through wallboxes with `SetOptAllow` set to `false` and turns them off immediately. Sets their `SetAmp` to the minimum allowed value and logs the action.
     * 2. **Processes Wallboxes with `ChargeNOW` set to true:**
     *    - For wallboxes that are allowed (`SetOptAllow` is `true`) and have `ChargeNOW` set to `true`, it attempts to allocate as much current as possible based on their `SetOptAmp` value.
     *    - If the total requested current exceeds the maximum allowed (`maxAmpTotal`), it adjusts the current allocation to fit within the limit.
     *    - If there is not enough remaining current to meet the wallbox's minimum requirement, it turns off the wallbox and logs the action.
     * 3. **Handles Remaining Wallboxes with `ChargeManager`:**
     *    - For wallboxes that are allowed (`SetOptAllow` is `true`), do not have `ChargeNOW` set to `true`, but have a `ChargeManager`, it attempts to allocate current as available.
     *    - Similar to the second step, it adjusts the allocation if the total exceeds the maximum allowed current and turns off the wallbox if not enough current is available.
     *
     */
    chargeLimiter() {
        let TotalSetOptAmp = 0;
        // First loop: Wallboxes with SetOptAllow = false (shall be turned off immediately)
        this.wallboxInfoList
            .filter(wallbox => !wallbox.SetOptAllow)
            .forEach(wallbox => {
            wallbox.SetAllow = false;
            wallbox.SetAmp = wallbox.MinAmp;
            this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} switched off due to SetOptAllow being false`);
        });
        // Second loop: Wallboxes with ChargeNOW = true (enable as much current as available)
        this.wallboxInfoList
            .filter(wallbox => wallbox.SetOptAllow && wallbox.ChargeNOW)
            .forEach(wallbox => {
            if (wallbox.SetOptAmp > this.config.maxAmpTotal) {
                wallbox.SetOptAmp = this.config.maxAmpTotal;
            }
            if (TotalSetOptAmp + wallbox.SetOptAmp <= this.config.maxAmpTotal) {
                wallbox.SetAmp = wallbox.SetOptAmp;
                wallbox.SetAllow = true;
                this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) verified charge with ${wallbox.SetAmp}A`);
                TotalSetOptAmp += wallbox.SetAmp;
            }
            else {
                if (this.config.maxAmpTotal - TotalSetOptAmp >= wallbox.MinAmp) {
                    wallbox.SetAmp = this.config.maxAmpTotal - TotalSetOptAmp;
                    wallbox.SetAllow = true;
                    this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) verified throttled charge with ${wallbox.SetAmp}A`);
                    TotalSetOptAmp += wallbox.SetAmp;
                }
                else {
                    wallbox.SetAmp = wallbox.MinAmp;
                    wallbox.SetAllow = false;
                    this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) switched off due to not enough remaining total current`);
                }
            }
        });
        // Third loop: Remaining wallboxes without ChargeNOW, so boxes with ChargeManager
        this.wallboxInfoList
            .filter(wallbox => wallbox.SetOptAllow && !wallbox.ChargeNOW && wallbox.ChargeManager)
            .forEach(wallbox => {
            if (wallbox.SetOptAmp > this.config.maxAmpTotal) {
                wallbox.SetOptAmp = this.config.maxAmpTotal;
            }
            if (TotalSetOptAmp + wallbox.SetOptAmp <= this.config.maxAmpTotal) {
                wallbox.SetAmp = wallbox.SetOptAmp;
                wallbox.SetAllow = true;
                this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) verified charge with ${wallbox.SetAmp}A`);
                TotalSetOptAmp += wallbox.SetAmp;
            }
            else {
                if (this.config.maxAmpTotal - TotalSetOptAmp >= wallbox.MinAmp) {
                    wallbox.SetAmp = this.config.maxAmpTotal - TotalSetOptAmp;
                    wallbox.SetAllow = true;
                    this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) verified throttled charge with ${wallbox.SetAmp}A`);
                    TotalSetOptAmp += wallbox.SetAmp;
                }
                else {
                    wallbox.SetAmp = wallbox.MinAmp;
                    wallbox.SetAllow = false;
                    this.log.debug(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) switched off due to not enough remaining total current`);
                }
            }
        });
    } // END Charge_Limiter
    /**
     * Configures the charging settings for all wallboxes based on their allowed state and charge current.
     *
     * This method performs the following actions:
     * 1. **Turn Off Wallboxes:**
     *    - Iterates through the list of wallboxes and sets the state of wallboxes that are not allowed to charge (`SetAllow` is false).
     *    - Updates the charge state to off and sets the charge current to the minimum (which may be zero or a specified value).
     * 2. **Turn On Wallboxes:**
     *    - Iterates through the list of wallboxes that are allowed to charge (`SetAllow` is true).
     *    - Checks if the total current including the new wallbox does not exceed the maximum allowed total current.
     *    - Updates the charge state and current for these wallboxes.
     *
     */
    chargeConfig() {
        // First loop: Turn off wallboxes that are not allowed to charge
        this.wallboxInfoList
            .filter(wallbox => !wallbox.SetAllow) // first switch off boxes
            .forEach(wallbox => {
            try {
                this.setForeignState(this.config.wallBoxList[wallbox.ID].stateChargeAllowed, wallbox.SetAllow);
                this.setForeignState(this.config.wallBoxList[wallbox.ID].stateChargeCurrent, Number(wallbox.SetAmp));
                // Consider awaiting confirmation or feedback here if necessary
            }
            catch (error) {
                this.log.error(`Charger Config: Error in setting values for wallbox ${wallbox.ID}: ${error}`);
            }
            this.log.debug(`Charger Config: Shutdown Wallbox ${wallbox.ID} - ${wallbox.SetAmp} Ampere`);
        });
        // Second loop: Configure wallboxes that are allowed to charge
        this.wallboxInfoList
            .filter(wallbox => wallbox.SetAllow) // wallboxes with operation
            .forEach(wallbox => {
            if (totalMeasuredChargeCurrent + (wallbox.SetAmp - wallbox.MeasuredMaxChargeAmp) <= this.config.maxAmpTotal) {
                // HIER FEHLT NOCH DIE DEAKTIVIERUNG NICHT VORHANDENER AUTOS!!!
                try {
                    this.setForeignState(this.config.wallBoxList[wallbox.ID].stateChargeCurrent, Number(wallbox.SetAmp));
                    this.setForeignState(this.config.wallBoxList[wallbox.ID].stateChargeAllowed, wallbox.SetAllow);
                }
                catch (error) {
                    this.log.error(`Charger Config: Error in setting charging for wallbox ${wallbox.ID}: ${error}`);
                }
                this.log.debug(`Charger Config: Wallbox ${wallbox.ID} switched on for charge with ${wallbox.SetAmp}A`);
            }
        });
    } // END Charge_Config
    /**
     * calcTotalPower
     * Calculates the total charging power and current for all wallboxes in the system.
     *
     * This method performs the following actions:
     *
     * 1. **Loop through Each Wallbox:**
     *    - For each wallbox in `this.wallboxInfoList`, it retrieves:
     *      - The current charging power (`ChargePower`) from a specified state.
     *      - The maximum measured charging current (`MeasuredMaxChargeAmp`) from a specified state.
     *    - Both values are updated for each wallbox.
     *    - The total charging power and the total measured current are accumulated.
     * 2. **Update States and Log:**
     *    - The total charging power is set in the state `"Power.Charge"` with the accumulated value.
     *    - Logs the total measured charging power and current.
     *
     */
    async calcTotalPower() {
        totalChargePower = 0;
        totalMeasuredChargeCurrent = 0;
        try {
            for (const wallbox of this.wallboxInfoList) {
                wallbox.ChargePower = (await this.projectUtils.asyncGetForeignStateVal(this.config.wallBoxList[wallbox.ID].stateActiveChargePower)) ?? 0;
                wallbox.MeasuredMaxChargeAmp = (await this.projectUtils.asyncGetForeignStateVal(this.config.wallBoxList[wallbox.ID].stateActiveChargeAmp)) ?? 0;
                //this.log.debug(`Got charge power of wallbox ${wallbox.ID}: ${wallbox.ChargePower} W; ${wallbox.MeasuredMaxChargeAmp} A`);
                totalChargePower += wallbox.ChargePower;
                totalMeasuredChargeCurrent += Math.ceil(wallbox.MeasuredMaxChargeAmp);
            }
            void this.setState(`Power.Charge`, totalChargePower, true); // trim to Watt
            this.log.debug(`Total measured charge power: ${totalChargePower}W - Total measured charge current: ${totalMeasuredChargeCurrent}A`);
        }
        catch (error) {
            this.log.error(`Error in reading charge power of wallboxes: ${error}`);
        }
    }
} // END Class
/*****************************************************************************************/
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new ChargeMaster(options);
}
else {
    // otherwise start the instance directly
    new ChargeMaster();
}
//# sourceMappingURL=main.js.map