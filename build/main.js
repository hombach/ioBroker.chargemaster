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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const projectUtils_1 = require("./lib/projectUtils");
let OptAmpere = 6;
let OffVerzoegerung = 0;
let SolarPower = 0;
let HouseConsumption = 0;
let BatSoC = 0;
let MinHomeBatVal = 85;
let TotalSetOptAmp = 0;
let TotalChargePower = 0;
let TotalMeasuredChargeCurrent = 0;
class ChargeMaster extends utils.Adapter {
    wallboxInfoList = [];
    adapterIntervals;
    projectUtils = new projectUtils_1.ProjectUtils(this);
    OffHysterese = 3;
    constructor(options = {}) {
        super({
            ...options,
            name: "chargemaster",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.wallboxInfoList = [];
        this.adapterIntervals = [];
    }
    /****************************************************************************************
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        if (!this.config.cycleTime) {
            this.log.warn(`Cycletime not configured or zero - will be set to 10 seconds`);
            this.config.cycleTime = 10000;
        }
        this.log.info(`Cycletime set to: ${this.config.cycleTime / 1000} seconds`);
        this.subscribeStates("Settings.*"); // this.subscribeForeignObjects('dwd.0.warning.*');
        //#region *** Verify configured foreign states chargers and amount of chargers ***
        async function stateTest(adapter, input) {
            if (input == "") {
                return false;
            }
            try {
                const ret = await adapter.getForeignObjectAsync(input);
                adapter.log.debug(`Foreign state verification by getForeignObjectAsync() returns: ${ret}`);
                if (ret == null) {
                    throw new Error(`State "${input}" does not exist.`);
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
            this.setState("info.connection", false, true);
            this.log.error(`Solar system states not correct configured or not reachable - shutting down adapter`);
            this.terminate;
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
                this.setState("info.connection", false, true);
                this.log.error(`Charger ${i} not correct configured or not reachable - shutting down adapter`);
                this.terminate;
                return;
            }
        }
        //#endregion
        //#region *** Setup configured amount of charger control objects ***
        for (let i = 0; i < this.config.wallBoxList.length; i++) {
            this.projectUtils.checkAndSetValueBoolean(`Settings.WB_${i}.ChargeNOW`, false, `ChargeNOW enabled for wallbox ${i}`, true, true);
            this.projectUtils.checkAndSetValueBoolean(`Settings.WB_${i}.ChargeManager`, false, `Charge Manager for wallbox ${i} enabled`, true, true);
            this.projectUtils.checkAndSetValueNumber(`Settings.WB_${i}.ChargeCurrent`, 6, `Set chargeNOW current output for wallbox ${i}`, "A", true, true);
        }
        //#endregion
        //sentry.io ping
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
                            scope.setTag("System Power", this.config.maxAmpTotal);
                            for (let i = 0; i < Math.min(this.config.wallBoxList.length, 2); i++) {
                                scope.setTag(`WallboxAmp_${i}`, this.config.wallBoxList[i].maxAmp);
                            }
                            Sentry.captureMessage("Adapter chargemaster started", "info");
                        });
                }
                this.setState("info.LastSentryLogDay", { val: today.getDate(), ack: true });
            }
        }
        try {
            MinHomeBatVal = await this.projectUtils.getStateValue(`Settings.Setpoint_HomeBatSoC`);
            for (let i = 0; i < this.config.wallBoxList.length; i++) {
                //this.wallboxInfoList[i].ChargeNOW = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`);
                //this.wallboxInfoList[i].ChargeManager = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`);
                //this.wallboxInfoList[i].ChargeCurrent = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`);
                this.wallboxInfoList.push({
                    ChargeNOW: await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`),
                    ChargeManager: await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`),
                    ChargeCurrent: await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`),
                    ChargePower: 0,
                    MeasuredMaxChargeAmp: 0,
                    MinAmp: this.config.wallBoxList[i].minAmp,
                    MaxAmp: this.config.wallBoxList[i].maxAmp,
                    SetOptAmp: 5,
                    SetOptAllow: false,
                    SetAmp: 0,
                    SetAllow: false,
                });
            }
            this.Calc_Total_Power();
        }
        catch (error) {
            this.setState("info.connection", false, true);
            this.log.error(`Unhandled exception processing initial state check: ${error}`);
        }
        this.setState("info.connection", true, true);
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
        catch (error) {
            callback();
        }
    }
    /****************************************************************************************
     * Is called if a subscribed state changes
     * @param { string } id
     * @param { ioBroker.State | null | undefined } state */
    async onStateChange(id, state) {
        try {
            if (state) {
                // The state was changed
                if (!state.ack) {
                    this.log.info(`state ${id} changed to: ${state.val} (ack = ${state.ack})`);
                    const subId = id.substring(id.indexOf(`Settings.`));
                    if (subId === "Settings.Setpoint_HomeBatSoC") {
                        MinHomeBatVal = await this.projectUtils.getStateValue("Settings.Setpoint_HomeBatSoC");
                        this.setState("Settings.Setpoint_HomeBatSoC", MinHomeBatVal, true);
                    }
                    else {
                        for (let i = 0; i < this.config.wallBoxList.length; i++) {
                            if (subId === `Settings.WB_${i}.ChargeNOW`) {
                                this.wallboxInfoList[i].ChargeNOW = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`);
                                this.setState(`Settings.WB_${i}.ChargeNOW`, this.wallboxInfoList[i].ChargeNOW, true);
                                break;
                            }
                            else if (subId === `Settings.WB_${i}.ChargeManager`) {
                                this.wallboxInfoList[i].ChargeManager = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`);
                                this.setState(`Settings.WB_${i}.ChargeManager`, this.wallboxInfoList[i].ChargeManager, true);
                                break;
                            }
                            else if (subId === `Settings.WB_${i}.ChargeCurrent`) {
                                this.wallboxInfoList[i].ChargeCurrent = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`);
                                this.setState(`Settings.WB_${i}.ChargeCurrent`, this.wallboxInfoList[i].ChargeCurrent, true);
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
    /*****************************************************************************************/
    async StateMachine() {
        let i = 0;
        while (true) {
            await this.delay(this.config.cycleTime);
            this.log.debug(`StateMachine cycle started`);
            await this.Calc_Total_Power();
            for (i = 0; i < this.config.wallBoxList.length; i++) {
                if (this.wallboxInfoList[i].ChargeNOW) {
                    // Charge-NOW is enabled
                    this.wallboxInfoList[i].SetOptAmp = this.wallboxInfoList[i].ChargeCurrent; // keep active charging current!!
                    this.wallboxInfoList[i].SetOptAllow = true;
                    this.log.debug(`State machine: Wallbox ${i} planned for charge-now with ${this.wallboxInfoList[i].SetOptAmp}A`);
                }
                else if (this.wallboxInfoList[i].ChargeManager) {
                    // Charge-Manager is enabled for this wallbox
                    BatSoC = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomeBatSoc);
                    this.log.debug(`State machine: Got external state of battery SoC: ${BatSoC}%`);
                    if (BatSoC >= MinHomeBatVal) {
                        // SoC of home battery sufficient?
                        await this.Charge_Manager(i);
                    }
                    else {
                        // FUTURE: time of day forces emptying of home battery
                        this.wallboxInfoList[i].SetOptAmp = this.wallboxInfoList[i].MinAmp;
                        this.wallboxInfoList[i].SetOptAllow = false;
                        this.log.debug(`State machine: Wait for home battery SoC of ${MinHomeBatVal}%`);
                    }
                }
                else {
                    // switch OFF; set to min. current;
                    this.wallboxInfoList[i].SetOptAmp = this.wallboxInfoList[i].MinAmp;
                    this.wallboxInfoList[i].SetOptAllow = false;
                    this.log.debug(`State machine: Wallbox ${i} planned for switch off`);
                }
            }
            await this.Charge_Limiter();
            await this.Charge_Config();
        }
        // WiP - const jobStateMachine = setTimeout(this.StateMachine.bind(this), this.config.cycletime);
        // WiP - if (jobStateMachine) this.adapterIntervals.push(jobStateMachine);
    }
    /*****************************************************************************************/
    async Charge_Manager(i) {
        SolarPower = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomeSolarPower);
        this.log.debug(`Charge Manager: Got external state of solar power: ${SolarPower} W`);
        HouseConsumption = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomePowerConsumption);
        this.log.debug(`Charge Manager: Got external state of house power consumption: ${HouseConsumption} W`);
        OptAmpere = Math.floor((SolarPower -
            HouseConsumption +
            0 * TotalChargePower - // Bedingte !!!! Einbeziehung von ChargePower vorallem charge now!!!
            100 + // Reserve
            (2000 / (100 - MinHomeBatVal)) * (BatSoC - MinHomeBatVal)) / // max. 2000 fÜr Batterieleerung
            230);
        if (OptAmpere > this.wallboxInfoList[i].MaxAmp)
            OptAmpere = this.wallboxInfoList[i].MaxAmp; // limiting to max current of single box - global will be limited later
        this.log.debug(`Charge Manager: Optimal charging current of Wallbox ${i} would be: ${OptAmpere} A`);
        if (this.wallboxInfoList[i].SetOptAmp < OptAmpere) {
            this.wallboxInfoList[i].SetOptAmp++;
        }
        else if (this.wallboxInfoList[i].SetOptAmp > OptAmpere) {
            this.wallboxInfoList[i].SetOptAmp--;
        }
        this.log.debug(`Charge Manager: Wallbox ${i} blended current: ${this.wallboxInfoList[i].SetOptAmp} A; ` +
            `Solar power: ${SolarPower} W; ` +
            `Haus consumption: ${HouseConsumption} W; ` +
            `Total charger power: ${TotalChargePower} W`);
        if (this.wallboxInfoList[i].SetOptAmp > Number(this.OffHysterese) + Number(this.wallboxInfoList[i].MinAmp)) {
            this.wallboxInfoList[i].SetOptAllow = true; // An und Zielstrom da größer MinAmp + Hysterese
        }
        else if (this.wallboxInfoList[i].SetOptAmp < this.wallboxInfoList[i].MinAmp) {
            OffVerzoegerung++;
            if (OffVerzoegerung > 15) {
                this.wallboxInfoList[i].SetOptAllow = false; // Off
                OffVerzoegerung = 0;
            }
        }
        this.log.debug(`Charge Manager: Wallbox ${i} planned state: ${this.wallboxInfoList[i].SetOptAllow}`);
    } // END Charge_Manager
    /*****************************************************************************************/
    async Charge_Limiter() {
        let i = 0;
        TotalSetOptAmp = 0;
        for (i = 0; i < this.config.wallBoxList.length; i++) {
            // switch of boxes and adjust local limits
            if (this.wallboxInfoList[i].SetOptAllow == false) {
                // Switch of imediately
                this.wallboxInfoList[i].SetAllow = false;
                this.wallboxInfoList[i].SetAmp = this.wallboxInfoList[i].MinAmp;
                this.log.debug(`Charge Limiter: Wallbox ${i} verified for switch off`);
            }
            else {
                // verify SetOptAmp against total current
                if (this.wallboxInfoList[i].SetOptAmp > this.config.maxAmpTotal) {
                    this.wallboxInfoList[i].SetOptAmp = this.config.maxAmpTotal;
                }
                if (TotalSetOptAmp + this.wallboxInfoList[i].SetOptAmp <= this.config.maxAmpTotal) {
                    // enough current available
                    this.wallboxInfoList[i].SetAmp = this.wallboxInfoList[i].SetOptAmp;
                    this.wallboxInfoList[i].SetAllow = true;
                    this.log.debug(`Charge Limiter: Wallbox ${i} verified charge with ${this.wallboxInfoList[i].SetAmp}A`);
                    TotalSetOptAmp = TotalSetOptAmp + this.wallboxInfoList[i].SetAmp;
                }
                else {
                    // not enough current available, throttled charge
                    if (this.config.maxAmpTotal - TotalSetOptAmp >= this.wallboxInfoList[i].MinAmp) {
                        // still enough above min current?
                        this.wallboxInfoList[i].SetAmp = this.config.maxAmpTotal - TotalSetOptAmp;
                        this.wallboxInfoList[i].SetAllow = true;
                        this.log.debug(`Charge Limiter: Wallbox ${i} verified throttled charge with ${this.wallboxInfoList[i].SetAmp}A`);
                        TotalSetOptAmp = TotalSetOptAmp + this.wallboxInfoList[i].SetAmp;
                    }
                    else {
                        // not enough above min current -> switch off charger
                        this.wallboxInfoList[i].SetAmp = this.wallboxInfoList[i].MinAmp;
                        this.wallboxInfoList[i].SetAllow = false;
                        this.log.debug(`Charge Limiter: Wallbox ${i} switched off due to not enough remaining total current`);
                    }
                }
            }
        }
    } // END Charge_Limiter
    /*****************************************************************************************/
    async Charge_Config() {
        let i = 0;
        for (i = 0; i < this.config.wallBoxList.length; i++) {
            if (this.wallboxInfoList[i].SetAllow == false) {
                // first switch off boxes
                try {
                    this.setForeignState(this.config.wallBoxList[i].stateChargeAllowed, this.wallboxInfoList[i].SetAllow);
                    this.setForeignState(this.config.wallBoxList[i].stateChargeCurrent, Number(this.wallboxInfoList[i].SetAmp));
                    // evtl. FEEDBACK ABFRAGEN!
                }
                catch (error) {
                    this.log.error(`Charger Config: Error in setting values for wallbox ${i}: ${error}`);
                } // END try-catch
                this.log.debug(`Charger Config: Shutdown Wallbox ${i} - ${this.wallboxInfoList[i].SetAmp} Ampere`);
            }
            else if (TotalMeasuredChargeCurrent + (this.wallboxInfoList[i].SetAmp - this.wallboxInfoList[i].MeasuredMaxChargeAmp) <=
                this.config.maxAmpTotal) {
                // HIER FEHLT NOCH DIE DEAKTIVIERUNG NICHT VORHANDENER AUTOS!!!
                try {
                    this.setForeignState(this.config.wallBoxList[i].stateChargeCurrent, Number(this.wallboxInfoList[i].SetAmp));
                    this.setForeignState(this.config.wallBoxList[i].stateChargeAllowed, this.wallboxInfoList[i].SetAllow);
                }
                catch (error) {
                    this.log.error(`Charger Config: Error in setting charging for wallbox ${i}: ${error}`);
                } // END try-catch
                this.log.debug(`Charger Config: Wallbox ${i} switched on for charge with ${this.wallboxInfoList[i].SetAmp}A`);
            }
        } // END for
    } // END Charge_Config
    /*****************************************************************************************/
    async Calc_Total_Power() {
        let i = 0;
        //this.log.debug(`Get charge power of all wallboxes`);
        TotalChargePower = 0;
        TotalMeasuredChargeCurrent = 0;
        try {
            for (i = 0; i < this.config.wallBoxList.length; i++) {
                this.wallboxInfoList[i].ChargePower = await this.projectUtils.asyncGetForeignStateVal(this.config.wallBoxList[i].stateActiveChargePower);
                this.wallboxInfoList[i].MeasuredMaxChargeAmp = await this.projectUtils.asyncGetForeignStateVal(this.config.wallBoxList[i].stateActiveChargeAmp);
                //this.log.debug(`Got charge power of wallbox ${i}: ${Wallbox[i].ChargePower} W; ${Wallbox[i].MeasuredMaxChargeAmp} A`);
                TotalChargePower += this.wallboxInfoList[i].ChargePower;
                TotalMeasuredChargeCurrent += Math.ceil(this.wallboxInfoList[i].MeasuredMaxChargeAmp);
            }
            this.setState("Power.Charge", TotalChargePower, true); // trim to Watt
            this.log.debug(`Total measured charge power: ${TotalChargePower}W - Total measured charge current: ${TotalMeasuredChargeCurrent}A`);
        }
        catch (error) {
            this.log.error(`Error in reading charge power of wallboxes: ${error}`);
        } // END catch
    } // END Calc_Total_Power
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