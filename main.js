'use strict';

// The adapter-core module gives you access to the core ioBroker functions, you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const schedule = require('node-schedule');
const adapterIntervals = {};

// Variablen
let OptAmpere        = 6;
let OffVerzoegerung  = 0;


var Wallbox = [
    {   ChargeNOW: false, ChargeManager: false,
        ChargeCurrent: 0, ChargePower: 0, MeasuredMaxChargeAmp: 0,
        MinAmp: 6, MaxAmp: 8,
        SetOptAmp: 5, SetOptAllow: false, SetAmp: 0, SetAllow: false
    },
    {   ChargeNOW: false, ChargeManager: false,
        ChargeCurrent: 0, ChargePower: 0, MeasuredMaxChargeAmp: 0,
        MinAmp: 6, MaxAmp: 8,
        SetOptAmp: 5, SetOptAllow: false, SetAmp: 0, SetAllow: false
    },
    {   ChargeNOW: false, ChargeManager: false,
        ChargeCurrent: 0, ChargePower: 0, MeasuredMaxChargeAmp: 0,
        MinAmp: 6, MaxAmp: 8,
        SetOptAmp: 5, SetOptAllow: false, SetAmp: 0, SetAllow: false
    }
];

let SolarPower          = 0;
let HouseConsumption    = 0;
let BatSoC              = 0;
let MinHomeBatVal       = 85;
let TotalSetOptAmp      = 0;
let TotalChargePower    = 0;
let TotalMeasuredChargeCurrent  = 0;


class chargemaster extends utils.Adapter {

    /****************************************************************************************
    * @param {Partial<utils.AdapterOptions>} [options={}]
    */
    constructor(options) {
        super({
            ...options,
            name: 'chargemaster'
        });
        this.on('ready', this.onReady.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }


    /****************************************************************************************
    * Is called when databases are connected and adapter received configuration.
    */
    async onReady() {
        if (!this.config.cycletime) {
            this.log.warn('Cycletime not configured or zero - will be set to 10 seconds');
            this.config.cycletime = 10000;
        }
        this.log.info('Cycletime set to: ' + (this.config.cycletime / 1000) + ' seconds');

        this.subscribeStates('Settings.*');
        // this.subscribeStates('*'); // all states changes inside the adapters namespace are subscribed
        // this.subscribeForeignObjects('dwd.0.warning.*');

        try {
            this.getState('Settings.Setpoint_HomeBatSoC', (_err, state) => { MinHomeBatVal = Number(state.val) });
            //this.getState('Settings.WB_0.ChargeNOW', (_err, state) => { Wallbox[0].ChargeNOW = Boolean(state.val) });
            Wallbox[0].ChargeNOW = await this.asyncGetStateVal('Settings.WB_0.ChargeNOW');
            this.log.debug(`Wallbox[0].ChargeNOW: ${Wallbox[0].ChargeNOW}`);
            this.getState('Settings.WB_0.ChargeManager', (_err, state) => { Wallbox[0].ChargeManager = Boolean(state.val) });
            Wallbox[0].ChargeCurrent = await this.asyncGetStateVal('Settings.WB_0.ChargeCurrent');
            this.getState('Settings.WB_1.ChargeNOW', (_err, state) => { Wallbox[1].ChargeNOW = Boolean(state.val) });
            this.getState('Settings.WB_1.ChargeManager', (_err, state) => { Wallbox[1].ChargeManager = Boolean(state.val) });
            Wallbox[1].ChargeCurrent = await this.asyncGetStateVal('Settings.WB_1.ChargeCurrent');
            this.getState('Settings.WB_2.ChargeNOW', (_err, state) => { Wallbox[2].ChargeNOW = Boolean(state.val) });
            this.getState('Settings.WB_2.ChargeManager', (_err, state) => { Wallbox[2].ChargeManager = Boolean(state.val) });
            Wallbox[2].ChargeCurrent = await this.asyncGetStateVal('Settings.WB_2.ChargeCurrent');
            this.Calc_Total_Power();
        } catch (e) {
            this.log.error(`Unhandled exception processing initial state check: ${e}`);
        }

        Wallbox[0].MinAmp = this.config.MinAmpWallBox0;
        Wallbox[0].MaxAmp = this.config.MaxAmpWallBox0;
        Wallbox[1].MinAmp = this.config.MinAmpWallBox1;
        Wallbox[1].MaxAmp = this.config.MaxAmpWallBox1;
        Wallbox[2].MinAmp = this.config.MinAmpWallBox2;
        Wallbox[2].MaxAmp = this.config.MaxAmpWallBox2;

        this.log.debug(`Init done, launching state machine`);
        this.StateMachine();
    }


    /****************************************************************************************
    * Is called if a subscribed state changes
    * @param { string } id
    * @param { ioBroker.State | null | undefined } state */
    onStateChange(id, state) {
        try {
            if (state) { // The state was changed
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                switch (id) { 
                    case 'Settings.Setpoint_HomeBatSoC':
                        this.getState('Settings.Setpoint_HomeBatSoC', (_err, state) => { MinHomeBatVal = Number(state.val) }); // Get Desired Battery SoC
                        break;
                    case 'Settings.WB_1.ChargeNOW':
                        this.getState('Settings.WB_1.ChargeNOW', (_err, state) => { Wallbox[0].ChargeNOW = Boolean(state.val) });
                        break;
                    case 'Settings.WB_1.ChargeManager':
                        this.getState('Settings.WB_1.ChargeManager', (_err, state) => { Wallbox[0].ChargeManager = Boolean(state.val) });
                        break;
                    case 'Settings.WB_1.ChargeCurrent':
                        this.getState('Settings.WB_1.ChargeCurrent', (_err, state) => { Wallbox[0].ChargeCurrent = Number(state.val) });
                        break;
                    case 'Settings.WB_2.ChargeNOW':
                        this.getState('Settings.WB_2.ChargeNOW', (_err, state) => { Wallbox[1].ChargeNOW = Boolean(state.val) });
                        break;
                    case 'Settings.WB_2.ChargeManager':
                        this.getState('Settings.WB_2.ChargeManager', (_err, state) => { Wallbox[1].ChargeManager = Boolean(state.val) });
                        break;
                    case 'Settings.WB_2.ChargeCurrent':
                        this.getState('Settings.WB_2.ChargeCurrent', (_err, state) => { Wallbox[1].ChargeCurrent = Number(state.val) });
                        break;
                    case 'Settings.WB_3.ChargeNOW':
                        this.getState('Settings.WB_3.ChargeNOW', (_err, state) => { Wallbox[2].ChargeNOW = Boolean(state.val) });
                        break;
                    case 'Settings.WB_3.ChargeManager':
                        this.getState('Settings.WB_3.ChargeManager', (_err, state) => { Wallbox[2].ChargeManager = Boolean(state.val) });
                        break;
                    case 'Settings.WB_3.ChargeCurrent':
                        this.getState('Settings.WB_3.ChargeCurrent', (_err, state) => { Wallbox[2].ChargeCurrent = Number(state.val) });
                        break;
                }


            } else {     // The state was deleted
                this.log.warn(`state ${id} deleted`);
            }
        } catch (e) {
            this.log.error(`Unhandled exception processing stateChange: ${e}`);
        }
    }


    /****************************************************************************************
    * Is called when adapter shuts down - callback has to be called under any circumstances!
    * @param {() => void} callback */
    onUnload(callback) {
        try {
            clearTimeout(adapterIntervals.stateMachine);
            clearTimeout(adapterIntervals.total);
            Object.keys(adapterIntervals).forEach(interval => clearInterval(adapterIntervals[interval]));
            this.log.info(`Adaptor ChargeMaster cleaned up everything...`);
            callback();
        } catch (e) {
            callback();
        }
    }

    
    /*****************************************************************************************/
    StateMachine() {
        let i = 0;
        this.log.debug(`StateMachine cycle started`);
        this.Calc_Total_Power();

        for (i = 2; i <= 2; i++) {
            if (Wallbox[i].ChargeNOW) { // Charge-NOW is enabled
//               this.Charge_Config('1', Wallbox[i].ChargeCurrent, 'Wallbox für Ladung aktivieren');  // keep active charging current!!
                Wallbox[i].SetOptAmp = Wallbox[i].ChargeCurrent;  // keep active charging current!!
                Wallbox[i].SetOptAllow = true;
            }

            else if (Wallbox[i].ChargeManager) { // Charge-Manager is enabled for this wallbox
                this.getForeignState(this.config.StateHomeBatSoc, (_err, state) => {
                    this.BatSoC = state.val;
                    this.log.debug(`Got external state of battery SoC: ${BatSoC}%`);
                    if (BatSoC >= MinHomeBatVal) { // SoC of home battery sufficient?
//                        this.Charge_Manager();
                        this.Charge_Manager(i);
                    }
                    else { // FUTURE: time of day forces emptying of home battery
//                        ZielAmpere = Wallbox[i].MinAmp;
                        Wallbox[i].SetOptAmp = Wallbox[i].MinAmp;
//                        this.Charge_Config('0', ZielAmpere, `Hausbatterie laden bis ${MinHomeBatVal}%`);
                        Wallbox[i].SetOptAllow = false;
                    }
                });
            }

            else { // switch OFF; set to min. current; 
//                ZielAmpere = Wallbox[i].MinAmp;
                Wallbox[i].SetOptAmp = Wallbox[i].MinAmp;
//                this.Charge_Config('0', ZielAmpere, `Wallbox 2 abschalten`);
                Wallbox[i].SetOptAllow = false;
            }
        }

        this.Charge_Limiter
        this.Charge_Config

        adapterIntervals.stateMachine = setTimeout(this.StateMachine.bind(this), this.config.cycletime);
    }


    /*****************************************************************************************/
    Charge_Manager(iBox) {
        this.getForeignState(this.config.StateHomeSolarPower, (_err, state) => { SolarPower = Number(state.val) });
        this.log.debug(`Got external state of solar power: ${SolarPower} W`);
        this.getForeignState(this.config.StateHomePowerConsumption, (_err, state) => { HouseConsumption = Number(state.val) });
        this.log.debug(`Got external state of house power consumption: ${HouseConsumption} W`);
        //        this.getForeignState(this.config.StateHomeBatSoc, (_err, state) => { this.BatSoC = state.val });
        //        this.log.debug(`Got external state of battery SoC: ${BatSoC}%`);
        //        this.Calc_Total_Power();

        OptAmpere = (Math.floor(
            (SolarPower - HouseConsumption + TotalChargePower - 100
                + ((2000 / (100 - MinHomeBatVal)) * (BatSoC - MinHomeBatVal))) / 230)); // -100 W Reserve + max. 2000 fÜr Batterieleerung

        this.log.debug(`Optimal charging current would be: ${OptAmpere} A`);
        //        if (OptAmpere > 16) OptAmpere = 16; 
        if (OptAmpere > Wallbox[iBox].MaxAmp) OptAmpere = Wallbox[iBox].MaxAmp; // limiting to max current of single box - global will be limited later

//        if (ZielAmpere < OptAmpere) {
        if (Wallbox[iBox].SetPointAmp < OptAmpere) {
//            ZielAmpere++
            Wallbox[iBox].SetPointAmp++;
//        } else if (ZielAmpere > OptAmpere) ZielAmpere--;
        } else if (Wallbox[iBox].SetPointAmp > OptAmpere) Wallbox[iBox].SetPointAmp--;

//        this.log.debug(`ZielAmpere: ${ZielAmpere} Ampere; Leistung DC: ${SolarPower} W; `
//            + `Hausverbrauch: ${HouseConsumption} W; Gesamtleistung alle Charger: ${TotalChargePower} W`);
        this.log.debug(`Wallbox: ${iBox} ZielAmpere: ${Wallbox[iBox].SetPointAmp} Ampere; Leistung DC: ${SolarPower} W; `
            + `Hausverbrauch: ${HouseConsumption} W; Gesamtleistung alle Charger: ${TotalChargePower} W`);

//        if (ZielAmpere > (5 + 4)) {
        if (Wallbox[iBox].SetPointAmp >= (Wallbox[iBox].MinAmp + 4)) {
//            this.Charge_Config('1', ZielAmpere, `Charging current: ${ZielAmpere} A`); // An und Zielstrom da größer 5 + Hysterese
            Wallbox[iBox].SetPointAllow = true; // An und Zielstrom da größer MinAmp + Hysterese
//        } else if (ZielAmpere < 6) {
        } else if (Wallbox[iBox].SetPointAmp < Wallbox[iBox].MinAmp) {
            OffVerzoegerung++;
            if (OffVerzoegerung > 12) {
//                this.Charge_Config('0', ZielAmpere, `zu wenig Überschuss`); // Aus und Zielstrom
                Wallbox[iBox].SetPointAllow = false; // Aus und Zielstrom
                OffVerzoegerung = 0;
            }
        }
    } // END Charge_Manager


    /*****************************************************************************************/
    Charge_Limiter() {
        let iBox = 0;
        TotalSetOptAmp = 0;
        for (iBox = 0; iBox <= 2; iBox++) { // switch of boxes and adjust local limits
            if (Wallbox[iBox].SetOptAllow = false) { // Switch of imediately
                Wallbox[iBox].SetAllow = false;
                Wallbox[iBox].SetAmp = Wallbox[iBox].SetOptAmp;
            }
            else { // verifiy SetOptAmp against total current
                if (Wallbox[iBox].SetOptAmp > this.config.MaxAmpTotal) { Wallbox[iBox].SetOptAmp = this.config.MaxAmpTotal }
                if (TotalSetOptAmp + Wallbox[iBox].SetOptAmp <= this.config.MaxAmpTotal) { // enough current available
                    Wallbox[iBox].SetAmp = Wallbox[iBox].SetOptAmp;
                    Wallbox[iBox].SetAllow = true;
                    TotalSetOptAmp = TotalSetOptAmp + Wallbox[iBox].SetAmp;
                }
                else { // not enough current available
                    if (this.config.MaxAmpTotal - TotalSetOptAmp >= Wallbox[iBox].MinAmp) { // still enough above min current?
                        Wallbox[iBox].SetAmp = this.config.MaxAmpTotal - TotalSetOptAmp;
                        Wallbox[iBox].SetAllow = true;
                        TotalSetOptAmp = TotalSetOptAmp + Wallbox[iBox].SetAmp;
                    }
                } 
            }

        }
    } // END Charge_Limiter


    /*****************************************************************************************/
//    Charge_Config(Allow, Ampere, LogMessage) {
//        this.log.debug(`${LogMessage}  -  ${Ampere} Ampere`);
//        try {
//            this.setForeignState(this.config.StateWallBox2ChargeCurrent, Ampere);
//            this.setForeignState(this.config.StateWallBox2ChargeAllowed, Allow);
//        } catch (e) {
//            this.log.error(`Error in setting charging for wallbox 2: ${e}`);
//        } // END catch
//    } // END Charge_Config
    Charge_Config() {
        let iBox = 0;
        for (iBox = 0; iBox <= 2; iBox++) {
            if (Wallbox[iBox].SetAllow = false) { // first switch off boxes
                try {
                    switch (iBox) {
                        case 0:
                            this.setForeignState(this.config.StateWallBox0ChargeAllowed, Wallbox[iBox].SetAllow);
                            this.setForeignState(this.config.StateWallBox0ChargeCurrent, Wallbox[iBox].SetAmp);
                        case 1:
                            this.setForeignState(this.config.StateWallBox1ChargeAllowed, Wallbox[iBox].SetAllow);
                            this.setForeignState(this.config.StateWallBox1ChargeCurrent, Wallbox[iBox].SetAmp);
                        case 2:
                            this.setForeignState(this.config.StateWallBox2ChargeAllowed, Wallbox[iBox].SetAllow);
                            this.setForeignState(this.config.StateWallBox2ChargeCurrent, Wallbox[iBox].SetAmp);
// FEEDBACK ABFRAGEN!!!!

                    }
                } catch (e) {
                    this.log.error(`Error in setting charging for wallbox ${iBox}: ${e}`);
                } // END try-catch
                this.log.debug(`Wallbox ${iBox} abschalten  -  ${Wallbox[iBox].SetAmp} Ampere`);
            }
            else if (TotalMeasuredChargeCurrent + (Wallbox[iBox].SetAmp - Wallbox[iBox].MeasuredMaxChargeAmp) <= this.config.MaxAmpTotal) {
                //HIER FEHLT NOCH DIE DEAKTIVIERUNG NICHT VORHANDENER AUTOS!!!
                try {
                    switch (iBox) {
                        case 0:
                            this.setForeignState(this.config.StateWallBox0ChargeCurrent, Wallbox[iBox].SetAmp);
                            this.setForeignState(this.config.StateWallBox0ChargeAllowed, Wallbox[iBox].SetAllow);
                        case 1:
                            this.setForeignState(this.config.StateWallBox1ChargeCurrent, Wallbox[iBox].SetAmp);
                            this.setForeignState(this.config.StateWallBox1ChargeAllowed, Wallbox[iBox].SetAllow);
                        case 2:
                            this.setForeignState(this.config.StateWallBox2ChargeCurrent, Wallbox[iBox].SetAmp);
                            this.setForeignState(this.config.StateWallBox2ChargeAllowed, Wallbox[iBox].SetAllow);
                    }
                } catch (e) {
                    this.log.error(`Error in setting charging for wallbox ${iBox}: ${e}`);
                } // END try-catch
                this.log.debug(`Wallbox ${iBox} für Ladung aktivieren  -  ${Wallbox[iBox].SetAmp} Ampere`);
            }
        }

    } // END Charge_Config


    /*****************************************************************************************/
    async Calc_Total_Power() {
        this.log.debug(`Get charge power of all wallboxes`);
        try {
            Wallbox[0].ChargePower = await this.asyncGetForeignStateVal(this.config.StateWallBox0ChargePower);
            Wallbox[0].MeasuredMaxChargeAmp = await this.asyncGetForeignStateVal(this.config.StateWallBox0MeasuredMaxChargeAmp);
            this.log.debug(`Got charge power of wallbox 0: ${Wallbox[0].ChargePower} W; ${Wallbox[0].MeasuredMaxChargeAmp} A`);
            Wallbox[1].ChargePower = await this.asyncGetForeignStateVal(this.config.StateWallBox1ChargePower);
            Wallbox[1].MeasuredMaxChargeAmp = await this.asyncGetForeignStateVal(this.config.StateWallBox1MeasuredMaxChargeAmp);
            this.log.debug(`Got charge power of wallbox 1: ${Wallbox[1].ChargePower} W; ${Wallbox[1].MeasuredMaxChargeAmp} A`);
            Wallbox[2].ChargePower = await this.asyncGetForeignStateVal(this.config.StateWallBox2ChargePower);
            Wallbox[2].MeasuredMaxChargeAmp = await this.asyncGetForeignStateVal(this.config.StateWallBox2MeasuredMaxChargeAmp);
            this.log.debug(`Got charge power of wallbox 2: ${Wallbox[2].ChargePower} W; ${Wallbox[2].MeasuredMaxChargeAmp} A`);

            TotalChargePower = Wallbox[0].ChargePower + Wallbox[1].ChargePower + Wallbox[2].ChargePower;
            this.setStateAsync('Power.Charge', TotalChargePower, true); // trim to Watt
            TotalMeasuredChargeCurrent = Math.ceil(Wallbox[0].MeasuredMaxChargeAmp) + Math.ceil(Wallbox[1].MeasuredMaxChargeAmp) + Math.ceil(Wallbox[2].MeasuredMaxChargeAmp);

        } catch (e) {
            this.log.error(`Error in reading charge power of wallboxes: ${e}`);
        } // END catch
    } // END Calc_Total_Power


    /**
    * Get foreign state value
    * @param {string}      statePath  - Full path to state, like 0_userdata.0.other.isSummer
    * @return {Promise<*>}            - State value, or null if error
    */
     async asyncGetForeignStateVal(statePath) {
        try {
            let stateObject = await this.asyncGetForeignState(statePath);
            if (stateObject == null) return null; // errors thrown already in asyncGetForeignState()
            return stateObject.val;
        } catch (e) {
            this.log.error(`[asyncGetForeignStateValue](${statePath}): ${e}`);
            return null;
        }
    }

    /**
    * Get foreign state
    * 
    * @param {string}      statePath  - Full path to state, like 0_userdata.0.other.isSummer
    * @return {Promise<object>}       - State object: {val: false, ack: true, ts: 1591117034451, …}, or null if error
    */
    async asyncGetForeignState(statePath) {
        try {
            let stateObject = await this.getForeignObjectAsync(statePath); // Check state existence
            if (!stateObject) {
                throw (`State '${statePath}' does not exist.`);
            } else { // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const stateValueObject = await this.getForeignStateAsync(statePath);
                if (!this.isLikeEmpty(stateValueObject)) {
                    return stateValueObject;
                } else {
                    throw (`Unable to retrieve info from state '${statePath}'.`);
                }
            }
        } catch (e) {
            this.log.error(`[asyncGetForeignState](${statePath}): ${e}`);
            return null;
        }
    }

    /**
    * Get state value
    * @param {string}      statePath  - Path to state, like other.isSummer
    * @return {Promise<*>}            - State value, or null if error
    */
    async asyncGetStateVal(statePath) {
        try {
            let stateObject = await this.asyncGetState(statePath);
            if (stateObject == null) return null; // errors thrown already in asyncGetState()
            return stateObject.val;
        } catch (e) {
            this.log.error(`[asyncGetStateValue](${statePath}): ${e}`);
            return null;
        }
    }

    /**
    * Get state
    * 
    * @param {string}      statePath  - Path to state, like other.isSummer
    * @return {Promise<object>}       - State object: {val: false, ack: true, ts: 1591117034451, …}, or null if error
    */
    async asyncGetState(statePath) {
        try {
            let stateObject = await this.getObjectAsync(statePath); // Check state existence
            if (!stateObject) {
                throw (`State '${statePath}' does not exist.`);
            } else { // Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
                const stateValueObject = await this.getStateAsync(statePath);
                if (!this.isLikeEmpty(stateValueObject)) {
                    return stateValueObject;
                } else {
                    throw (`Unable to retrieve info from state '${statePath}'.`);
                }
            }
        } catch (e) {
            this.log.error(`[asyncGetState](${statePath}): ${e}`);
            return null;
        }
    }

    isLikeEmpty(inputVar) {
        if (typeof inputVar !== 'undefined' && inputVar !== null) {
            let sTemp = JSON.stringify(inputVar);
            sTemp = sTemp.replace(/\s+/g, ''); // remove all white spaces
            sTemp = sTemp.replace(/"+/g,  ''); // remove all >"<
            sTemp = sTemp.replace(/'+/g,  ''); // remove all >'<
            sTemp = sTemp.replace(/\[+/g, ''); // remove all >[<
            sTemp = sTemp.replace(/\]+/g, ''); // remove all >]<
            sTemp = sTemp.replace(/\{+/g, ''); // remove all >{<
            sTemp = sTemp.replace(/\}+/g, ''); // remove all >}<
            if (sTemp !== '') {
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    }
         
} // END Class


/*****************************************************************************************/
// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
    * @param {Partial<utils.AdapterOptions>} [options={}]
    */
    module.exports = (options) => new chargemaster(options);
} else { // otherwise start the instance directly
    new chargemaster();
}