'use strict';

// The adapter-core module gives you access to the core ioBroker functions, you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const schedule = require('node-schedule');
const adapterIntervals = {};

// Variablen
let ZielAmpere       = 5;
let OptAmpere        = 6;
let MinHomeBatVal    = 87;
let OffVerzoegerung  = 0;

var Wallbox = [
    {   ChargeNOW: false, ChargeManager: false,
        ChargeCurrent: 0, ChargePower: 0
    },
    {   ChargeNOW: false, ChargeManager: false,
        ChargeCurrent: 0, ChargePower: 0
    },
    {   ChargeNOW: false, ChargeManager: false,
        ChargeCurrent: 0, ChargePower: 0
    }
];

let TotalChargePower = 0;
let SolarPower       = 0;
let HouseConsumption = 0;
let BatSoC           = 0;


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
            this.getState('Settings.Setpoint_HomeBatSoC', (_err, state) => { this.MinHomeBatVal = state.val });
            this.getState('Settings.WB_0.ChargeNOW', (_err, state) => { Wallbox[0].ChargeNOW = state.val });
            this.getState('Settings.WB_0.ChargeManager', (_err, state) => { Wallbox[0].ChargeManager = state.val });
            this.getState('Settings.WB_0.ChargeCurrent', (_err, state) => { Wallbox[0].ChargeCurrent = state.val });
            this.getState('Settings.WB_1.ChargeNOW', (_err, state) => { Wallbox[1].ChargeNOW = state.val });
            this.getState('Settings.WB_1.ChargeManager', (_err, state) => { Wallbox[1].ChargeManager = state.val });
            this.getState('Settings.WB_1.ChargeCurrent', (_err, state) => { Wallbox[1].ChargeCurrent = state.val });
            this.getState('Settings.WB_2.ChargeNOW', (_err, state) => { Wallbox[2].ChargeNOW = state.val });
            this.getState('Settings.WB_2.ChargeManager', (_err, state) => { Wallbox[2].ChargeManager = state.val });
            this.getState('Settings.WB_2.ChargeCurrent', (_err, state) => { Wallbox[2].ChargeCurrent = state.val });
            this.Calc_Total_Power();
        } catch (e) {
            this.log.error(`Unhandled exception processing initial state check: ${e}`);
        }

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
                        this.getState('Settings.Setpoint_HomeBatSoC', (_err, state) => { this.MinHomeBatVal = state.val }); // Get Desired Battery SoC
                        break;
                    case 'Settings.WB_1.ChargeNOW':
                        this.getState('Settings.WB_1.ChargeNOW', (_err, state) => { Wallbox[0].ChargeNOW = state.val });
                        break;
                    case 'Settings.WB_1.ChargeManager':
                        this.getState('Settings.WB_1.ChargeManager', (_err, state) => { Wallbox[0].ChargeManager = state.val });
                        break;
                    case 'Settings.WB_1.ChargeCurrent':
                        this.getState('Settings.WB_1.ChargeCurrent', (_err, state) => { Wallbox[0].ChargeCurrent = state.val });
                        break;
                    case 'Settings.WB_2.ChargeNOW':
                        this.getState('Settings.WB_2.ChargeNOW', (_err, state) => { Wallbox[1].ChargeNOW = state.val });
                        break;
                    case 'Settings.WB_2.ChargeManager':
                        this.getState('Settings.WB_2.ChargeManager', (_err, state) => { Wallbox[1].ChargeManager = state.val });
                        break;
                    case 'Settings.WB_2.ChargeCurrent':
                        this.getState('Settings.WB_2.ChargeCurrent', (_err, state) => { Wallbox[1].ChargeCurrent = state.val });
                        break;
                    case 'Settings.WB_3.ChargeNOW':
                        this.getState('Settings.WB_3.ChargeNOW', (_err, state) => { Wallbox[2].ChargeNOW = state.val });
                        break;
                    case 'Settings.WB_3.ChargeManager':
                        this.getState('Settings.WB_3.ChargeManager', (_err, state) => { Wallbox[2].ChargeManager = state.val });
                        break;
                    case 'Settings.WB_3.ChargeCurrent':
                        this.getState('Settings.WB_3.ChargeCurrent', (_err, state) => { Wallbox[2].ChargeCurrent = state.val });
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
        this.log.debug(`StateMachine cycle started`);
        this.Calc_Total_Power();

        if (Wallbox[2].ChargeNOW) { // Charge-NOW is enabled
            this.Charge_Config('1', Wallbox[2].ChargeCurrent, 'Wallbox für Ladung aktivieren');  // keep active charging current!!
        }

        else if (Wallbox[2].ChargeManager) { // Charge-Manager is enabled
            this.getForeignState(this.config.StateHomeBatSoc, (_err, state) => {
                this.BatSoC = state.val;
                this.log.debug(`Got external state of battery SoC: ${BatSoC}%`);
                if (BatSoC >= MinHomeBatVal) { // SoC of home battery sufficient?
                    this.Charge_Manager();
                }
                else { // FUTURE: time of day forces emptying of home battery
                    ZielAmpere = 6;
                    this.Charge_Config('0', ZielAmpere, `Hausbatterie laden bis ${MinHomeBatVal}%`);
                }
            });
        }

        else { // switch OFF; set to min. current; 
                    ZielAmpere = 6;
                    this.Charge_Config('0', ZielAmpere, `Wallbox abschalten`);
        }

        adapterIntervals.stateMachine = setTimeout(this.StateMachine.bind(this), this.config.cycletime);
    }


    /***********************************OBSOLETE!!!******************************************************/
    ParseStatus(status) {
        this.setStateAsync('Info.CarState', status.car, true);
        switch (status.car) {
            case "1":
                this.setStateAsync('Info.CarStateString', 'Wallbox ready, no car', true);
                break;
            case "2":
                this.setStateAsync('Info.CarStateString', 'Charging...', true);
                break;
            case "3":
                this.setStateAsync('Info.CarStateString', 'Wait for car', true);
                break;
            case "4":
                this.setStateAsync('Info.CarStateString', 'Charge finished, car still connected', true);
                break;
            default:
                this.setStateAsync('Info.CarStateString', 'Error', true);
        }
        this.setStateAsync('Power.Charge', (status.nrg[11] * 10), true); // trim to Watt
    }


    /*****************************************************************************************/
    Charge_Config(Allow, Ampere, LogMessage) {
        this.log.debug(`${LogMessage}  -  ${Ampere} Ampere`);
        try {
            this.setForeignState(this.config.StateWallBox2ChargeCurrent, Ampere);
            this.setForeignState(this.config.StateWallBox2ChargeAllowed, Allow);
        } catch (e) {
            this.log.error(`Error in setting charging for wallbox 2: ${e}`);
        } // END catch
    } // END Charge_Config


    /*****************************************************************************************/
    Charge_Manager() {
        this.getForeignState(this.config.StateHomeSolarPower, (_err, state) => { this.SolarPower = state.val });
        this.log.debug(`Got external state of solar power: ${SolarPower} W`);
        this.getForeignState(this.config.StateHomePowerConsumption, (_err, state) => { this.HouseConsumption = state.val });
        this.log.debug(`Got external state of house power consumption: ${HouseConsumption} W`);
//        this.getForeignState(this.config.StateHomeBatSoc, (_err, state) => { this.BatSoC = state.val });
//        this.log.debug(`Got external state of battery SoC: ${BatSoC}%`);
//        this.Calc_Total_Power();

        OptAmpere = (Math.floor(
            (SolarPower - HouseConsumption + TotalChargePower - 100
                + ((2000 / (100 - MinHomeBatVal)) * (BatSoC - MinHomeBatVal))) / 230)); // -100 W Reserve + max. 2000 fÜr Batterieleerung

        this.log.debug(`Optimal charging current would be: ${OptAmpere} A`);
        if (OptAmpere > 16) OptAmpere = 16;

        if (ZielAmpere < OptAmpere) {
            ZielAmpere++;
        } else if (ZielAmpere > OptAmpere) ZielAmpere--;

        this.log.debug(`ZielAmpere: ${ZielAmpere} Ampere; Leistung DC: ${SolarPower} W; `
            + `Hausverbrauch: ${HouseConsumption} W; Gesamtleistung alle Charger: ${TotalChargePower} W`);
        
        if (ZielAmpere > (5 + 4)) {
            this.Charge_Config('1', ZielAmpere, `Charging current: ${ZielAmpere} A`); // An und Zielstrom da größer 5 + Hysterese
        } else if (ZielAmpere < 6) {
            OffVerzoegerung++;
            if (OffVerzoegerung > 12) {
                this.Charge_Config('0', ZielAmpere, `zu wenig Überschuss`); // Aus und Zielstrom
                OffVerzoegerung = 0;
            }
        }
    } // END Charge_Manager


    /*****************************************************************************************/
    Calc_Total_Power() {
        this.log.debug(`Get charge power of all wallboxes`);
        try {
            this.getForeignState(this.config.StateWallBox0ChargePower, (_err, state) => {
                Wallbox[0].ChargePower = state.val;
            });
            this.log.debug(`Got charge power of wallbox 0; ${this.config.StateWallBox0ChargePower}: ${Wallbox[0].ChargePower.val}W`);
            this.getForeignState(this.config.StateWallBox1ChargePower, (_err, state) => {
                Wallbox[1].ChargePower = state.val;
            });
            this.log.debug(`Got charge power of wallbox 1; ${this.config.StateWallBox1ChargePower}: ${Wallbox[1].ChargePower}W`);
            this.getForeignState(this.config.StateWallBox2ChargePower, (_err, state) => {
                Wallbox[2].ChargePower = state.val;
            });
            this.log.debug(`Got charge power of wallbox 2; ${this.config.StateWallBox2ChargePower}: ${Wallbox[2].ChargePower}W`);
            TotalChargePower = Wallbox[0].ChargePower + Wallbox[1].ChargePower + Wallbox[2].ChargePower;
            this.setStateAsync('Power.Charge', TotalChargePower, true); // trim to Watt
        } catch (e) {
            this.log.error(`Error in reading charge power of wallboxes: ${e}`);
        } // END catch
    } // END Calc_Total_Power

       
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