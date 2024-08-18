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
const Wallbox = [
    {
        ChargeNOW: false,
        ChargeManager: false,
        ChargeCurrent: 0,
        ChargePower: 0,
        MeasuredMaxChargeAmp: 0,
        MinAmp: 6,
        MaxAmp: 8,
        SetOptAmp: 5,
        SetOptAllow: false,
        SetAmp: 0,
        SetAllow: false,
    },
    {
        ChargeNOW: false,
        ChargeManager: false,
        ChargeCurrent: 0,
        ChargePower: 0,
        MeasuredMaxChargeAmp: 0,
        MinAmp: 6,
        MaxAmp: 8,
        SetOptAmp: 5,
        SetOptAllow: false,
        SetAmp: 0,
        SetAllow: false,
    },
    {
        ChargeNOW: false,
        ChargeManager: false,
        ChargeCurrent: 0,
        ChargePower: 0,
        MeasuredMaxChargeAmp: 0,
        MinAmp: 6,
        MaxAmp: 8,
        SetOptAmp: 5,
        SetOptAllow: false,
        SetAmp: 0,
        SetAllow: false,
    },
];
let OptAmpere = 6;
let OffVerzoegerung = 0;
let SolarPower = 0;
let HouseConsumption = 0;
let BatSoC = 0;
let MinHomeBatVal = 85;
let TotalSetOptAmp = 0;
let TotalChargePower = 0;
let TotalMeasuredChargeCurrent = 0;
let maxCharger = 0;
class ChargeMaster extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "chargemaster",
        });
        this.OffHysterese = 3;
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
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
        // verify configured foreign states chargers and amount of chargers *****************************************************************
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
            catch (e) {
                adapter.log.error(`Configured state "${input}" is not OK and throws an error: "${e}"`);
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
            this.log.error(`Solar system states not correct configured or not reachable - shutting down adapter`);
            this.terminate;
            return;
        }
        for (let i = 0; i < this.config.wallBoxList.length; i++) {
            if ((await stateTest(this, this.config.wallBoxList[i].stateChargeCurrent)) &&
                (await stateTest(this, this.config.wallBoxList[i].stateChargeAllowed)) &&
                (await stateTest(this, this.config.wallBoxList[i].stateActiveChargePower)) &&
                (await stateTest(this, this.config.wallBoxList[i].stateActiveChargeAmp))) {
                maxCharger = i;
                this.log.info(`Charger ${i} states verified`);
            }
            else {
                this.log.error(`Charger ${i} not correct configured or not reachable - shutting down adapter`);
                this.terminate;
                return;
            }
        }
        // *********************************************************************************************************************************
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
                            Sentry.captureMessage("Adapter chargemaster started", "info"); // Level "info"
                        });
                }
                this.setState("info.LastSentryLogDay", { val: today.getDate(), ack: true });
            }
        }
        try {
            MinHomeBatVal = await this.getStateVal("Settings.Setpoint_HomeBatSoC");
            Wallbox[0].ChargeNOW = await this.getStateVal("Settings.WB_0.ChargeNOW");
            Wallbox[0].ChargeManager = await this.getStateVal("Settings.WB_0.ChargeManager");
            Wallbox[0].ChargeCurrent = await this.getStateVal("Settings.WB_0.ChargeCurrent");
            Wallbox[1].ChargeNOW = await this.getStateVal("Settings.WB_1.ChargeNOW");
            Wallbox[1].ChargeManager = await this.getStateVal("Settings.WB_1.ChargeManager");
            Wallbox[1].ChargeCurrent = await this.getStateVal("Settings.WB_1.ChargeCurrent");
            Wallbox[2].ChargeNOW = await this.getStateVal("Settings.WB_2.ChargeNOW");
            Wallbox[2].ChargeManager = await this.getStateVal("Settings.WB_2.ChargeManager");
            Wallbox[2].ChargeCurrent = await this.getStateVal("Settings.WB_2.ChargeCurrent");
            this.Calc_Total_Power();
        }
        catch (error) {
            this.log.error(`Unhandled exception processing initial state check: ${error}`);
        }
        for (let i = 0; i < this.config.wallBoxList.length; i++) {
            Wallbox[i].MinAmp = this.config.wallBoxList[i].minAmp;
            Wallbox[i].MaxAmp = this.config.wallBoxList[i].maxAmp;
        }
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
                this.log.info(`state ${id} changed to: ${state.val} (ack = ${state.ack})`);
                const subId = id.substring(id.indexOf(`Settings.`));
                switch (subId) {
                    case "Settings.Setpoint_HomeBatSoC":
                        MinHomeBatVal = await this.getStateVal("Settings.Setpoint_HomeBatSoC");
                        this.setState("Settings.Setpoint_HomeBatSoC", MinHomeBatVal, true);
                        break;
                    case "Settings.WB_0.ChargeNOW":
                        Wallbox[0].ChargeNOW = await this.getStateVal("Settings.WB_0.ChargeNOW");
                        this.setState("Settings.WB_0.ChargeNOW", Wallbox[0].ChargeNOW, true);
                        break;
                    case "Settings.WB_0.ChargeManager":
                        Wallbox[0].ChargeManager = await this.getStateVal("Settings.WB_0.ChargeManager");
                        this.setState("Settings.WB_0.ChargeManager", Wallbox[0].ChargeManager, true);
                        break;
                    case "Settings.WB_0.ChargeCurrent":
                        Wallbox[0].ChargeCurrent = await this.getStateVal("Settings.WB_0.ChargeCurrent");
                        this.setState("Settings.WB_0.ChargeCurrent", Wallbox[0].ChargeCurrent, true);
                        break;
                    case "Settings.WB_1.ChargeNOW":
                        Wallbox[1].ChargeNOW = await this.getStateVal("Settings.WB_1.ChargeNOW");
                        this.setState("Settings.WB_1.ChargeNOW", Wallbox[1].ChargeNOW, true);
                        break;
                    case "Settings.WB_1.ChargeManager":
                        Wallbox[1].ChargeManager = await this.getStateVal("Settings.WB_1.ChargeManager");
                        this.setState("Settings.WB_1.ChargeManager", Wallbox[1].ChargeManager, true);
                        break;
                    case "Settings.WB_1.ChargeCurrent":
                        Wallbox[1].ChargeCurrent = await this.getStateVal("Settings.WB_1.ChargeCurrent");
                        this.setState("Settings.WB_1.ChargeCurrent", Wallbox[1].ChargeCurrent, true);
                        break;
                    case "Settings.WB_2.ChargeNOW":
                        Wallbox[2].ChargeNOW = await this.getStateVal("Settings.WB_2.ChargeNOW");
                        this.setState("Settings.WB_2.ChargeNOW", Wallbox[2].ChargeNOW, true);
                        break;
                    case "Settings.WB_2.ChargeManager":
                        Wallbox[2].ChargeManager = await this.getStateVal("Settings.WB_2.ChargeManager");
                        this.setState("Settings.WB_2.ChargeManager", Wallbox[2].ChargeManager, true);
                        break;
                    case "Settings.WB_2.ChargeCurrent":
                        Wallbox[2].ChargeCurrent = await this.getStateVal("Settings.WB_2.ChargeCurrent");
                        this.setState("Settings.WB_2.ChargeCurrent", Wallbox[2].ChargeCurrent, true);
                        break;
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
            for (i = 0; i <= maxCharger; i++) {
                if (Wallbox[i].ChargeNOW) {
                    // Charge-NOW is enabled
                    Wallbox[i].SetOptAmp = Wallbox[i].ChargeCurrent; // keep active charging current!!
                    Wallbox[i].SetOptAllow = true;
                    this.log.debug(`State machine: Wallbox ${i} planned for charge-now with ${Wallbox[i].SetOptAmp}A`);
                }
                else if (Wallbox[i].ChargeManager) {
                    // Charge-Manager is enabled for this wallbox
                    BatSoC = await this.asyncGetForeignStateVal(this.config.stateHomeBatSoc);
                    this.log.debug(`State machine: Got external state of battery SoC: ${BatSoC}%`);
                    if (BatSoC >= MinHomeBatVal) {
                        // SoC of home battery sufficient?
                        await this.Charge_Manager(i);
                    }
                    else {
                        // FUTURE: time of day forces emptying of home battery
                        Wallbox[i].SetOptAmp = Wallbox[i].MinAmp;
                        Wallbox[i].SetOptAllow = false;
                        this.log.debug(`State machine: Wait for home battery SoC of ${MinHomeBatVal}%`);
                    }
                }
                else {
                    // switch OFF; set to min. current;
                    Wallbox[i].SetOptAmp = Wallbox[i].MinAmp;
                    Wallbox[i].SetOptAllow = false;
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
        SolarPower = await this.asyncGetForeignStateVal(this.config.stateHomeSolarPower);
        this.log.debug(`Charge Manager: Got external state of solar power: ${SolarPower} W`);
        HouseConsumption = await this.asyncGetForeignStateVal(this.config.stateHomePowerConsumption);
        this.log.debug(`Charge Manager: Got external state of house power consumption: ${HouseConsumption} W`);
        OptAmpere = Math.floor((SolarPower - HouseConsumption + TotalChargePower - 100 + (2000 / (100 - MinHomeBatVal)) * (BatSoC - MinHomeBatVal)) / 230);
        // -100 W Reserve + max. 2000 fÜr Batterieleerung
        if (OptAmpere > Wallbox[i].MaxAmp)
            OptAmpere = Wallbox[i].MaxAmp; // limiting to max current of single box - global will be limited later
        this.log.debug(`Charge Manager: Optimal charging current of Wallbox ${i} would be: ${OptAmpere} A`);
        if (Wallbox[i].SetOptAmp < OptAmpere) {
            Wallbox[i].SetOptAmp++;
        }
        else if (Wallbox[i].SetOptAmp > OptAmpere) {
            Wallbox[i].SetOptAmp--;
        }
        this.log.debug(`Charge Manager: Wallbox ${i} blended current: ${Wallbox[i].SetOptAmp} A; ` +
            `Solar power: ${SolarPower} W; ` +
            `Haus consumption: ${HouseConsumption} W; ` +
            `Total charger power: ${TotalChargePower} W`);
        if (Wallbox[i].SetOptAmp > Number(this.OffHysterese) + Number(Wallbox[i].MinAmp)) {
            Wallbox[i].SetOptAllow = true; // An und Zielstrom da größer MinAmp + Hysterese
        }
        else if (Wallbox[i].SetOptAmp < Wallbox[i].MinAmp) {
            OffVerzoegerung++;
            if (OffVerzoegerung > 15) {
                Wallbox[i].SetOptAllow = false; // Off
                OffVerzoegerung = 0;
            }
        }
        this.log.debug(`Charge Manager: Wallbox ${i} planned state: ${Wallbox[i].SetOptAllow}`);
    } // END Charge_Manager
    /*****************************************************************************************/
    Charge_Limiter() {
        let i = 0;
        TotalSetOptAmp = 0;
        for (i = 0; i <= maxCharger; i++) {
            // switch of boxes and adjust local limits
            if (Wallbox[i].SetOptAllow == false) {
                // Switch of imediately
                Wallbox[i].SetAllow = false;
                Wallbox[i].SetAmp = Wallbox[i].MinAmp;
                this.log.debug(`Charge Limiter: Wallbox ${i} verified for switch off`);
            }
            else {
                // verify SetOptAmp against total current
                if (Wallbox[i].SetOptAmp > this.config.maxAmpTotal) {
                    Wallbox[i].SetOptAmp = this.config.maxAmpTotal;
                }
                if (TotalSetOptAmp + Wallbox[i].SetOptAmp <= this.config.maxAmpTotal) {
                    // enough current available
                    Wallbox[i].SetAmp = Wallbox[i].SetOptAmp;
                    Wallbox[i].SetAllow = true;
                    this.log.debug(`Charge Limiter: Wallbox ${i} verified charge with ${Wallbox[i].SetAmp}A`);
                    TotalSetOptAmp = TotalSetOptAmp + Wallbox[i].SetAmp;
                }
                else {
                    // not enough current available, throttled charge
                    if (this.config.maxAmpTotal - TotalSetOptAmp >= Wallbox[i].MinAmp) {
                        // still enough above min current?
                        Wallbox[i].SetAmp = this.config.maxAmpTotal - TotalSetOptAmp;
                        Wallbox[i].SetAllow = true;
                        this.log.debug(`Charge Limiter: Wallbox ${i} verified throttled charge with ${Wallbox[i].SetAmp}A`);
                        TotalSetOptAmp = TotalSetOptAmp + Wallbox[i].SetAmp;
                    }
                    else {
                        // not enough above min current -> switch off charger
                        Wallbox[i].SetAmp = Wallbox[i].MinAmp;
                        Wallbox[i].SetAllow = false;
                        this.log.debug(`Charge Limiter: Wallbox ${i} switched off due to not enough remaining total current`);
                    }
                }
            }
        }
    } // END Charge_Limiter
    /*****************************************************************************************/
    Charge_Config() {
        let i = 0;
        for (i = 0; i < this.config.wallBoxList.length; i++) {
            if (Wallbox[i].SetAllow == false) {
                // first switch off boxes
                try {
                    this.setForeignState(this.config.wallBoxList[i].stateChargeAllowed, Wallbox[i].SetAllow);
                    this.setForeignState(this.config.wallBoxList[i].stateChargeCurrent, Number(Wallbox[i].SetAmp));
                    // evtl. FEEDBACK ABFRAGEN!
                }
                catch (error) {
                    this.log.error(`Charger Config: Error in setting values for wallbox ${i}: ${error}`);
                } // END try-catch
                this.log.debug(`Charger Config: Shutdown Wallbox ${i} - ${Wallbox[i].SetAmp} Ampere`);
            }
            else if (TotalMeasuredChargeCurrent + (Wallbox[i].SetAmp - Wallbox[i].MeasuredMaxChargeAmp) <= this.config.maxAmpTotal) {
                // HIER FEHLT NOCH DIE DEAKTIVIERUNG NICHT VORHANDENER AUTOS!!!
                try {
                    this.setForeignState(this.config.wallBoxList[i].stateChargeCurrent, Number(Wallbox[i].SetAmp));
                    this.setForeignState(this.config.wallBoxList[i].stateChargeAllowed, Wallbox[i].SetAllow);
                }
                catch (error) {
                    this.log.error(`Charger Config: Error in setting charging for wallbox ${i}: ${error}`);
                } // END try-catch
                this.log.debug(`Charger Config: Wallbox ${i} switched on for charge with ${Wallbox[i].SetAmp}A`);
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
                Wallbox[i].ChargePower = await this.asyncGetForeignStateVal(this.config.wallBoxList[i].stateActiveChargePower);
                Wallbox[i].MeasuredMaxChargeAmp = await this.asyncGetForeignStateVal(this.config.wallBoxList[i].stateActiveChargeAmp);
                //this.log.debug(`Got charge power of wallbox ${i}: ${Wallbox[i].ChargePower} W; ${Wallbox[i].MeasuredMaxChargeAmp} A`);
                TotalChargePower += Wallbox[i].ChargePower;
                TotalMeasuredChargeCurrent += Math.ceil(Wallbox[i].MeasuredMaxChargeAmp);
            }
            this.setState("Power.Charge", TotalChargePower, true); // trim to Watt
            this.log.debug(`Total measured charge power: ${TotalChargePower}W - Total measured charge current: ${TotalMeasuredChargeCurrent}A`);
        }
        catch (error) {
            this.log.error(`Error in reading charge power of wallboxes: ${error}`);
        } // END catch
    } // END Calc_Total_Power
    /**
     * Get foreign state value
     * @param {string}      stateName  - Full path to state, like 0_userdata.0.other.isSummer
     * @return {Promise<*>}            - State value, or null if error
     */
    async asyncGetForeignStateVal(stateName) {
        try {
            const stateObject = await this.asyncGetForeignState(stateName);
            if (stateObject == null)
                return null; // errors thrown already in asyncGetForeignState()
            return stateObject.val;
        }
        catch (error) {
            this.log.error(`[asyncGetForeignStateValue](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Get foreign state
     *
     * @param {string}      stateName  - Full path to state, like 0_userdata.0.other.isSummer
     * @return {Promise<object>}       - State object: {val: false, ack: true, ts: 1591117034451, …}, or null if error
     */
    async asyncGetForeignState(stateName) {
        try {
            const stateObject = await this.getForeignObjectAsync(stateName); // Check state existence
            if (!stateObject) {
                throw `State '${stateName}' does not exist.`;
            }
            else {
                // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const stateValueObject = await this.getForeignStateAsync(stateName);
                if (!this.isLikeEmpty(stateValueObject)) {
                    return stateValueObject;
                }
                else {
                    throw `Unable to retrieve info from state '${stateName}'.`;
                }
            }
        }
        catch (error) {
            this.log.error(`[asyncGetForeignState](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Retrieves the value of a given state by its name.
     *
     * @param stateName - A string representing the name of the state to retrieve.
     * @returns A Promise that resolves with the value of the state if it exists, otherwise resolves with null.
     */
    async getStateVal(stateName) {
        try {
            const stateObject = await this.asyncGetState(stateName);
            return stateObject?.val ?? null; // errors have already been handled in asyncGetState()
        }
        catch (error) {
            this.log.error(`[getStateValue](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Retrieves the state object by its name.
     *
     * @param stateName - A string representing the name of the state to retrieve.
     * @returns A Promise that resolves with the object of the state if it exists, otherwise resolves with null.
     */
    async asyncGetState(stateName) {
        try {
            const stateObject = await this.getObjectAsync(stateName); // Check state existence
            if (!stateObject) {
                throw `State '${stateName}' does not exist.`;
            }
            else {
                // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const stateValueObject = await this.getStateAsync(stateName);
                if (!this.isLikeEmpty(stateValueObject)) {
                    return stateValueObject;
                }
                else {
                    throw `Unable to retrieve info from state '${stateName}'.`;
                }
            }
        }
        catch (error) {
            this.log.error(`[asyncGetState](${stateName}): ${error}`);
            return null;
        }
    }
    /**
     * Checks if the given input variable is effectively empty.
     *
     * This method examines the provided `inputVar` to determine if it contains any meaningful data.
     * It performs a series of transformations to strip out whitespace and common punctuation, then checks if the result is an empty string.
     *
     * @param inputVar - The state variable to check, which can be of type `ioBroker.State`, `null`, or `undefined`.
     * @returns A boolean indicating whether the input variable is considered empty (`true` if empty, `false` otherwise).
     */
    isLikeEmpty(inputVar) {
        if (typeof inputVar !== "undefined" && inputVar !== null) {
            let sTemp = JSON.stringify(inputVar);
            sTemp = sTemp.replace(/\s+/g, ""); // remove all white spaces
            sTemp = sTemp.replace(/"+/g, ""); // remove all >"<
            sTemp = sTemp.replace(/'+/g, ""); // remove all >'<
            sTemp = sTemp.replace(/\[+/g, ""); // remove all >[<
            sTemp = sTemp.replace(/\]+/g, ""); // remove all >]<
            sTemp = sTemp.replace(/\{+/g, ""); // remove all >{<
            sTemp = sTemp.replace(/\}+/g, ""); // remove all >}<
            if (sTemp !== "") {
                return false;
            }
            else {
                return true;
            }
        }
        else {
            return true;
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