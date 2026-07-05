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
const utils = __importStar(require("@iobroker/adapter-core"));
const chargeAlgorithms_1 = require("./lib/chargeAlgorithms");
const projectUtils_1 = require("./lib/projectUtils");
class ChargeMaster extends utils.Adapter {
    wallboxInfoList = [];
    projectUtils = new projectUtils_1.ProjectUtils(this);
    stopStateMachine = false;
    batSoC = 0;
    minHomeBatVal = 85;
    solarPower = 0;
    houseConsumption = 0;
    totalChargePower = 0;
    totalMeasuredChargeCurrent = 0;
    foreignStateUpdaters = new Map();
    triggerCycle = null;
    constructor(options = {}) {
        super({
            ...options,
            name: "chargemaster",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.wallboxInfoList = [];
    }
    async onReady() {
        if (!this.config.cycleTime) {
            this.log.warn(`Cycletime not configured or zero - will be set to 10 seconds`);
            this.config.cycleTime = 10000;
        }
        this.log.info(`Cycletime set to: ${this.config.cycleTime / 1000} seconds`);
        if (!this.config.maxAmpTotal) {
            this.log.warn(`Maximum total current not configured or zero - will be set to 6A`);
            this.config.maxAmpTotal = 6;
        }
        this.log.info(`Maximum total current set to: ${this.config.maxAmpTotal}A`);
        this.subscribeStates(`Settings.*`);
        async function stateTest(adapter, input) {
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
        for (let i = 0; i < this.config.wallBoxList.length; i++) {
            await this.projectUtils.checkAndSetValueBoolean(`Settings.WB_${i}.ChargeNOW`, false, `ChargeNOW enabled for wallbox ${i}`, `switch.enable`, true, true);
            await this.projectUtils.checkAndSetValueBoolean(`Settings.WB_${i}.ChargeManager`, false, `Charge Manager for wallbox ${i} enabled`, `switch.enable`, true, true);
            await this.projectUtils.checkAndSetValueNumber(`Settings.WB_${i}.ChargeCurrent`, 6, `Set chargeNOW current output for wallbox ${i}`, `A`, `level.current`, true, true);
        }
        if (this.supportsFeature && this.supportsFeature("PLUGINS")) {
            const sentryInstance = this.getPluginInstance("sentry");
            const today = new Date();
            const last = await this.getStateAsync("info.LastSentryLogDay");
            if (last?.val != today.getDate()) {
                if (sentryInstance) {
                    const Sentry = sentryInstance.getSentryObject();
                    Sentry &&
                        Sentry.withScope((scope) => {
                            scope.setLevel(`info`);
                            scope.setTag(`SentryDay`, today.getDate());
                            scope.setTag(`System Power`, this.config.maxAmpTotal);
                            for (let i = 0; i < Math.min(this.config.wallBoxList.length, 2); i++) {
                                scope.setTag(`WallboxAmp_${i}`, this.config.wallBoxList[i].maxAmp);
                            }
                            Sentry.captureMessage(`Adapter chargemaster started`, "info");
                        });
                }
                void this.setState(`info.LastSentryLogDay`, {
                    val: today.getDate(),
                    ack: true,
                });
            }
        }
        try {
            this.minHomeBatVal = (await this.projectUtils.getStateValue(`Settings.Setpoint_HomeBatSoC`)) ?? 80;
            for (let i = 0; i < this.config.wallBoxList.length; i++) {
                this.wallboxInfoList.push({
                    ID: i,
                    ChargeNOW: (await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`)) ?? false,
                    ChargeManager: (await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`)) ?? false,
                    ChargeCurrent: (await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`)) ?? 6,
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
            this.foreignStateUpdaters.set(this.config.stateHomeSolarPower, val => (this.solarPower = val));
            this.foreignStateUpdaters.set(this.config.stateHomePowerConsumption, val => (this.houseConsumption = val));
            this.foreignStateUpdaters.set(this.config.stateHomeBatSoc, val => (this.batSoC = val));
            for (const [i, box] of this.config.wallBoxList.entries()) {
                this.foreignStateUpdaters.set(box.stateActiveChargePower, val => (this.wallboxInfoList[i].ChargePower = val));
                this.foreignStateUpdaters.set(box.stateActiveChargeAmp, val => (this.wallboxInfoList[i].MeasuredMaxChargeAmp = val));
            }
            for (const [id, updateCache] of this.foreignStateUpdaters) {
                updateCache((await this.projectUtils.asyncGetForeignStateVal(id)) ?? 0);
            }
            await this.subscribeForeignStatesAsync([...this.foreignStateUpdaters.keys()]);
            this.calcTotalPower();
        }
        catch (error) {
            void this.setState(`info.connection`, false, true);
            this.log.error(`Unhandled exception processing initial state check: ${error}`);
        }
        void this.setState(`info.connection`, true, true);
        this.log.info(`Init done, launching state machine`);
        await this.StateMachine();
    }
    onUnload(callback) {
        try {
            this.stopStateMachine = true;
            this.triggerCycle?.();
            void this.setState(`info.connection`, false, true);
            this.log.info(`Adapter ChargeMaster cleaned up everything...`);
            callback();
        }
        catch {
            callback();
        }
    }
    onStateChange(id, state) {
        try {
            if (state) {
                const updateCache = this.foreignStateUpdaters.get(id);
                if (updateCache) {
                    if (typeof state.val === "number" && Number.isFinite(state.val)) {
                        updateCache(state.val);
                    }
                    else {
                        this.log.debug(`Ignoring non numeric value '${state.val}' of foreign state ${id}`);
                    }
                    return;
                }
                if (!state.ack) {
                    this.log.info(`state ${id} changed to: ${state.val} (ack = ${state.ack})`);
                    const subId = id.substring(id.indexOf(`Settings.`));
                    if (subId === `Settings.Setpoint_HomeBatSoC`) {
                        const newVal = typeof state.val === "number" ? state.val : typeof state.val === "string" ? parseInt(state.val) : Number.NaN;
                        if (Number.isFinite(newVal)) {
                            this.minHomeBatVal = Math.min(100, Math.max(0, newVal));
                            void this.setState(id, this.minHomeBatVal, true);
                        }
                        else {
                            this.log.warn(`Wrong value for Setpoint_HomeBatSoC: ${state.val}`);
                        }
                    }
                    else {
                        for (let i = 0; i < this.config.wallBoxList.length; i++) {
                            switch (subId) {
                                case `Settings.WB_${i}.ChargeNOW`:
                                    if (typeof state.val === "boolean") {
                                        this.wallboxInfoList[i].ChargeNOW = state.val;
                                        this.log.debug(`wallbox ${i} setting ChargeNOW changed to ${state.val}`);
                                        void this.setState(id, state.val, true);
                                    }
                                    else {
                                        this.log.warn(`Wrong type for wallbox ${i} setting ChargeNOW: ${state.val}`);
                                    }
                                    break;
                                case `Settings.WB_${i}.ChargeManager`:
                                    if (typeof state.val === "boolean") {
                                        this.wallboxInfoList[i].ChargeManager = state.val;
                                        this.log.debug(`wallbox ${i} setting ChargeManager changed to ${state.val}`);
                                        void this.setState(id, state.val, true);
                                    }
                                    else {
                                        this.log.warn(`Wrong type for wallbox ${i} setting ChargeManager: ${state.val}`);
                                    }
                                    break;
                                case `Settings.WB_${i}.ChargeCurrent`:
                                    if (typeof state.val === "number") {
                                        this.wallboxInfoList[i].ChargeCurrent = state.val;
                                        this.log.debug(`wallbox ${i} setting ChargeCurrent changed to ${state.val}`);
                                        void this.setState(id, state.val, true);
                                    }
                                    else {
                                        this.log.warn(`Wrong type for wallbox ${i} setting ChargeCurrent: ${state.val}`);
                                    }
                                    break;
                            }
                        }
                    }
                    this.triggerCycle?.();
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
    async StateMachine() {
        while (!this.stopStateMachine) {
            await Promise.race([
                this.delay(this.config.cycleTime),
                new Promise(resolve => {
                    this.triggerCycle = resolve;
                }),
            ]);
            this.triggerCycle = null;
            if (this.stopStateMachine) {
                break;
            }
            this.log.debug(`-x-x-x-x-x-x- StateMachine cycle started -x-x-x-x-x-x-`);
            this.calcTotalPower();
            for (const wallbox of this.wallboxInfoList) {
                if (wallbox.ChargeNOW) {
                    wallbox.SetOptAmp = wallbox.ChargeCurrent;
                    wallbox.SetOptAllow = true;
                    this.log.debug(`State machine: Wallbox ${wallbox.ID} planned for charge-now with ${wallbox.SetOptAmp}A`);
                }
                else if (wallbox.ChargeManager) {
                    this.log.debug(`State machine: Battery SoC (cached): ${this.batSoC}%`);
                    if (this.batSoC >= this.minHomeBatVal) {
                        this.chargeManager(wallbox.ID);
                    }
                    else {
                        wallbox.SetOptAmp = wallbox.MinAmp;
                        wallbox.SetOptAllow = false;
                        this.log.debug(`State machine: Wait for home battery SoC of ${this.minHomeBatVal}%`);
                    }
                }
                else {
                    wallbox.SetOptAmp = wallbox.MinAmp;
                    wallbox.SetOptAllow = false;
                    this.log.debug(`State machine: Wallbox ${wallbox.ID} planned for switch off`);
                }
            }
            this.chargeLimiter();
            await this.chargeConfig();
        }
    }
    chargeManager(ID) {
        const wallbox = this.wallboxInfoList.find(wallbox => wallbox.ID == ID);
        if (wallbox) {
            (0, chargeAlgorithms_1.planWallboxCharge)(wallbox, {
                solarPower: this.solarPower,
                houseConsumption: this.houseConsumption,
                batSoC: this.batSoC,
                minHomeBatSoC: this.minHomeBatVal,
                totalChargePower: this.totalChargePower,
            }, msg => this.log.debug(msg));
        }
    }
    chargeLimiter() {
        (0, chargeAlgorithms_1.limitTotalCurrent)(this.wallboxInfoList, this.config.maxAmpTotal, msg => this.log.debug(msg));
    }
    async chargeConfig() {
        for (const wallbox of this.wallboxInfoList.filter(wallbox => !wallbox.SetAllow)) {
            try {
                await this.setForeignStateAsync(this.config.wallBoxList[wallbox.ID].stateChargeAllowed, wallbox.SetAllow);
                await this.setForeignStateAsync(this.config.wallBoxList[wallbox.ID].stateChargeCurrent, Number(wallbox.SetAmp));
                this.log.debug(`Charger Config: Shutdown Wallbox ${wallbox.ID} - ${wallbox.SetAmp} Ampere`);
            }
            catch (error) {
                this.log.error(`Charger Config: Error in setting values for wallbox ${wallbox.ID}: ${error}`);
            }
        }
        for (const wallbox of this.wallboxInfoList.filter(wallbox => wallbox.SetAllow)) {
            const remainingAmp = this.config.maxAmpTotal - (this.totalMeasuredChargeCurrent - Math.ceil(wallbox.MeasuredMaxChargeAmp));
            const setAmp = Math.min(wallbox.SetAmp, remainingAmp);
            try {
                if (setAmp >= wallbox.MinAmp) {
                    await this.setForeignStateAsync(this.config.wallBoxList[wallbox.ID].stateChargeCurrent, Number(setAmp));
                    await this.setForeignStateAsync(this.config.wallBoxList[wallbox.ID].stateChargeAllowed, wallbox.SetAllow);
                    if (setAmp < wallbox.SetAmp) {
                        this.log.debug(`Charger Config: Wallbox ${wallbox.ID} throttled to ${setAmp}A due to measured total current`);
                    }
                    else {
                        this.log.debug(`Charger Config: Wallbox ${wallbox.ID} switched on for charge with ${setAmp}A`);
                    }
                }
                else {
                    await this.setForeignStateAsync(this.config.wallBoxList[wallbox.ID].stateChargeAllowed, false);
                    await this.setForeignStateAsync(this.config.wallBoxList[wallbox.ID].stateChargeCurrent, Number(wallbox.MinAmp));
                    this.log.debug(`Charger Config: Wallbox ${wallbox.ID} switched off - measured total current leaves no room within ${this.config.maxAmpTotal}A`);
                }
            }
            catch (error) {
                this.log.error(`Charger Config: Error in setting charging for wallbox ${wallbox.ID}: ${error}`);
            }
        }
    }
    calcTotalPower() {
        this.totalChargePower = 0;
        this.totalMeasuredChargeCurrent = 0;
        for (const wallbox of this.wallboxInfoList) {
            this.totalChargePower += wallbox.ChargePower;
            this.totalMeasuredChargeCurrent += Math.ceil(wallbox.MeasuredMaxChargeAmp);
        }
        void this.setState(`Power.Charge`, this.totalChargePower, true);
        this.log.debug(`Total measured charge power: ${this.totalChargePower}W - Total measured charge current: ${this.totalMeasuredChargeCurrent}A`);
    }
}
if (require.main !== module) {
    module.exports = (options) => new ChargeMaster(options);
}
else {
    new ChargeMaster();
}
//# sourceMappingURL=main.js.map