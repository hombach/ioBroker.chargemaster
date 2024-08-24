// The adapter-core module gives you access to the core ioBroker functions you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import { ProjectUtils } from "./lib/projectUtils";

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
let SolarPower: number = 0;
let HouseConsumption: number = 0;
let BatSoC: number = 0;
let MinHomeBatVal: number = 85;
let TotalSetOptAmp: number = 0;
let TotalChargePower: number = 0;
let TotalMeasuredChargeCurrent: number = 0;

class ChargeMaster extends utils.Adapter {
	adapterIntervals: NodeJS.Timeout[];
	projectUtils = new ProjectUtils(this);
	OffHysterese: number = 3;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "chargemaster",
		});
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
	private async onReady(): Promise<void> {
		if (!this.config.cycleTime) {
			this.log.warn(`Cycletime not configured or zero - will be set to 10 seconds`);
			this.config.cycleTime = 10000;
		}
		this.log.info(`Cycletime set to: ${this.config.cycleTime / 1000} seconds`);

		this.subscribeStates("Settings.*"); // this.subscribeForeignObjects('dwd.0.warning.*');

		//#region *** Verify configured foreign states chargers and amount of chargers ***
		async function stateTest(adapter: any, input: string): Promise<boolean> {
			if (input == "") {
				return false;
			}
			try {
				const ret = await adapter.getForeignObjectAsync(input);
				adapter.log.debug(`Foreign state verification by getForeignObjectAsync() returns: ${ret}`);
				if (ret == null) {
					throw new Error(`State "${input}" does not exist.`);
				}
			} catch (error) {
				adapter.log.error(`Configured state "${input}" is not OK and throws an error: "${error}"`);
				return false;
			}
			return true;
		}

		if (
			(await stateTest(this, this.config.stateHomeBatSoc)) &&
			(await stateTest(this, this.config.stateHomeSolarPower)) &&
			(await stateTest(this, this.config.stateHomePowerConsumption))
		) {
			this.log.info(`Verified solar system states`);
		} else {
			this.log.error(`Solar system states not correct configured or not reachable - shutting down adapter`);
			this.terminate;
			return;
		}

		for (let i = 0; i < this.config.wallBoxList.length; i++) {
			if (
				(await stateTest(this, this.config.wallBoxList[i].stateChargeCurrent)) &&
				(await stateTest(this, this.config.wallBoxList[i].stateChargeAllowed)) &&
				(await stateTest(this, this.config.wallBoxList[i].stateActiveChargePower)) &&
				(await stateTest(this, this.config.wallBoxList[i].stateActiveChargeAmp))
			) {
				this.log.info(`Charger ${i} states verified`);
			} else {
				this.log.error(`Charger ${i} not correct configured or not reachable - shutting down adapter`);
				this.terminate;
				return;
			}
		}
		//#endregion

		//#region *** Setup configured amount of charger control objects ***
		for (let i = 0; i < this.config.wallBoxList.length; i++) {
			//this.setState(`Settings.WB_${i}.ChargeNOW`, Wallbox[i].ChargeNOW, true);
			//this.setState(`Settings.WB_${i}.ChargeManager`, Wallbox[i].ChargeManager, true);
			//this.setState(`Settings.WB_${i}.ChargeCurrent`, Wallbox[i].ChargeCurrent, true);
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
						Sentry.withScope((scope: { setLevel: (arg0: string) => void; setTag: (arg0: string, arg1: number) => void }) => {
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
			MinHomeBatVal = await this.projectUtils.getStateValue("Settings.Setpoint_HomeBatSoC");
			for (let i = 0; i < this.config.wallBoxList.length; i++) {
				Wallbox[i].ChargeNOW = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`);
				Wallbox[i].ChargeManager = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`);
				Wallbox[i].ChargeCurrent = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`);
			}
			this.Calc_Total_Power();
		} catch (error) {
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
	private onUnload(callback: () => void): void {
		try {
			// WiP - Object.keys(this.adapterIntervals).forEach((timeOut) => clearTimeout(timeOut));
			this.log.info(`Adapter ChargeMaster cleaned up everything...`);
			callback();
		} catch (error) {
			callback();
		}
	}

	/****************************************************************************************
	 * Is called if a subscribed state changes
	 * @param { string } id
	 * @param { ioBroker.State | null | undefined } state */
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		try {
			if (state) {
				// The state was changed
				if (!state.ack) {
					this.log.info(`state ${id} changed to: ${state.val} (ack = ${state.ack})`);
					const subId = id.substring(id.indexOf(`Settings.`));
					if (subId === "Settings.Setpoint_HomeBatSoC") {
						MinHomeBatVal = await this.projectUtils.getStateValue("Settings.Setpoint_HomeBatSoC");
						this.setState("Settings.Setpoint_HomeBatSoC", MinHomeBatVal, true);
					} else {
						for (let i = 0; i < this.config.wallBoxList.length; i++) {
							if (subId === `Settings.WB_${i}.ChargeNOW`) {
								Wallbox[i].ChargeNOW = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeNOW`);
								this.setState(`Settings.WB_${i}.ChargeNOW`, Wallbox[i].ChargeNOW, true);
								break;
							} else if (subId === `Settings.WB_${i}.ChargeManager`) {
								Wallbox[i].ChargeManager = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeManager`);
								this.setState(`Settings.WB_${i}.ChargeManager`, Wallbox[i].ChargeManager, true);
								break;
							} else if (subId === `Settings.WB_${i}.ChargeCurrent`) {
								Wallbox[i].ChargeCurrent = await this.projectUtils.getStateValue(`Settings.WB_${i}.ChargeCurrent`);
								this.setState(`Settings.WB_${i}.ChargeCurrent`, Wallbox[i].ChargeCurrent, true);
								break;
							}
						}
					}
				}
			} else {
				this.log.warn(`state ${id} has been deleted`);
			}
		} catch (error) {
			this.log.error(`Unhandled exception processing stateChange: ${error}`);
		}
	}

	/****************************************************************************************
	 * Is called if a subscribed state changes
	 * @param { string } id
	 * @param { ioBroker.State | null | undefined } state */
	/*private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		try {
			if (state) {
				// The state was changed
				if (!state.ack) {
					this.log.info(`state ${id} changed to: ${state.val} (ack = ${state.ack})`);
					const subId = id.substring(id.indexOf(`Settings.`));
					switch (subId) {
						case "Settings.Setpoint_HomeBatSoC":
							MinHomeBatVal = await this.projectUtils.getStateValue("Settings.Setpoint_HomeBatSoC");
							this.setState("Settings.Setpoint_HomeBatSoC", MinHomeBatVal, true);
							break;
						case "Settings.WB_0.ChargeNOW":
							Wallbox[0].ChargeNOW = await this.projectUtils.getStateValue("Settings.WB_0.ChargeNOW");
							this.setState("Settings.WB_0.ChargeNOW", Wallbox[0].ChargeNOW, true);
							break;
						case "Settings.WB_0.ChargeManager":
							Wallbox[0].ChargeManager = await this.projectUtils.getStateValue("Settings.WB_0.ChargeManager");
							this.setState("Settings.WB_0.ChargeManager", Wallbox[0].ChargeManager, true);
							break;
						case "Settings.WB_0.ChargeCurrent":
							Wallbox[0].ChargeCurrent = await this.projectUtils.getStateValue("Settings.WB_0.ChargeCurrent");
							this.setState("Settings.WB_0.ChargeCurrent", Wallbox[0].ChargeCurrent, true);
							break;
						case "Settings.WB_1.ChargeNOW":
							Wallbox[1].ChargeNOW = await this.projectUtils.getStateValue("Settings.WB_1.ChargeNOW");
							this.setState("Settings.WB_1.ChargeNOW", Wallbox[1].ChargeNOW, true);
							break;
						case "Settings.WB_1.ChargeManager":
							Wallbox[1].ChargeManager = await this.projectUtils.getStateValue("Settings.WB_1.ChargeManager");
							this.setState("Settings.WB_1.ChargeManager", Wallbox[1].ChargeManager, true);
							break;
						case "Settings.WB_1.ChargeCurrent":
							Wallbox[1].ChargeCurrent = await this.projectUtils.getStateValue("Settings.WB_1.ChargeCurrent");
							this.setState("Settings.WB_1.ChargeCurrent", Wallbox[1].ChargeCurrent, true);
							break;
						case "Settings.WB_2.ChargeNOW":
							Wallbox[2].ChargeNOW = await this.projectUtils.getStateValue("Settings.WB_2.ChargeNOW");
							this.setState("Settings.WB_2.ChargeNOW", Wallbox[2].ChargeNOW, true);
							break;
						case "Settings.WB_2.ChargeManager":
							Wallbox[2].ChargeManager = await this.projectUtils.getStateValue("Settings.WB_2.ChargeManager");
							this.setState("Settings.WB_2.ChargeManager", Wallbox[2].ChargeManager, true);
							break;
						case "Settings.WB_2.ChargeCurrent":
							Wallbox[2].ChargeCurrent = await this.projectUtils.getStateValue("Settings.WB_2.ChargeCurrent");
							this.setState("Settings.WB_2.ChargeCurrent", Wallbox[2].ChargeCurrent, true);
							break;
					}
				}
			} else {
				this.log.warn(`state ${id} has been deleted`);
			}
		} catch (error) {
			this.log.error(`Unhandled exception processing stateChange: ${error}`);
		}
	}*/

	/*****************************************************************************************/
	private async StateMachine(): Promise<void> {
		let i: number = 0;
		while (true) {
			await this.delay(this.config.cycleTime);
			this.log.debug(`StateMachine cycle started`);

			await this.Calc_Total_Power();

			for (i = 0; i < this.config.wallBoxList.length; i++) {
				if (Wallbox[i].ChargeNOW) {
					// Charge-NOW is enabled
					Wallbox[i].SetOptAmp = Wallbox[i].ChargeCurrent; // keep active charging current!!
					Wallbox[i].SetOptAllow = true;
					this.log.debug(`State machine: Wallbox ${i} planned for charge-now with ${Wallbox[i].SetOptAmp}A`);
				} else if (Wallbox[i].ChargeManager) {
					// Charge-Manager is enabled for this wallbox
					BatSoC = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomeBatSoc);
					this.log.debug(`State machine: Got external state of battery SoC: ${BatSoC}%`);
					if (BatSoC >= MinHomeBatVal) {
						// SoC of home battery sufficient?
						await this.Charge_Manager(i);
					} else {
						// FUTURE: time of day forces emptying of home battery
						Wallbox[i].SetOptAmp = Wallbox[i].MinAmp;
						Wallbox[i].SetOptAllow = false;
						this.log.debug(`State machine: Wait for home battery SoC of ${MinHomeBatVal}%`);
					}
				} else {
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
	private async Charge_Manager(i: number): Promise<any> {
		SolarPower = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomeSolarPower);
		this.log.debug(`Charge Manager: Got external state of solar power: ${SolarPower} W`);
		HouseConsumption = await this.projectUtils.asyncGetForeignStateVal(this.config.stateHomePowerConsumption);
		this.log.debug(`Charge Manager: Got external state of house power consumption: ${HouseConsumption} W`);

		OptAmpere = Math.floor(
			(SolarPower -
				HouseConsumption +
				0 * TotalChargePower - // Bedingte !!!! Einbeziehung von ChargePower vorallem charge now!!!
				100 + // Reserve
				(2000 / (100 - MinHomeBatVal)) * (BatSoC - MinHomeBatVal)) / // max. 2000 fÜr Batterieleerung
				230,
		);
		if (OptAmpere > Wallbox[i].MaxAmp) OptAmpere = Wallbox[i].MaxAmp; // limiting to max current of single box - global will be limited later
		this.log.debug(`Charge Manager: Optimal charging current of Wallbox ${i} would be: ${OptAmpere} A`);

		if (Wallbox[i].SetOptAmp < OptAmpere) {
			Wallbox[i].SetOptAmp++;
		} else if (Wallbox[i].SetOptAmp > OptAmpere) {
			Wallbox[i].SetOptAmp--;
		}

		this.log.debug(
			`Charge Manager: Wallbox ${i} blended current: ${Wallbox[i].SetOptAmp} A; ` +
				`Solar power: ${SolarPower} W; ` +
				`Haus consumption: ${HouseConsumption} W; ` +
				`Total charger power: ${TotalChargePower} W`,
		);

		if (Wallbox[i].SetOptAmp > Number(this.OffHysterese) + Number(Wallbox[i].MinAmp)) {
			Wallbox[i].SetOptAllow = true; // An und Zielstrom da größer MinAmp + Hysterese
		} else if (Wallbox[i].SetOptAmp < Wallbox[i].MinAmp) {
			OffVerzoegerung++;
			if (OffVerzoegerung > 15) {
				Wallbox[i].SetOptAllow = false; // Off
				OffVerzoegerung = 0;
			}
		}
		this.log.debug(`Charge Manager: Wallbox ${i} planned state: ${Wallbox[i].SetOptAllow}`);
	} // END Charge_Manager

	/*****************************************************************************************/
	private async Charge_Limiter(): Promise<void> {
		let i = 0;
		TotalSetOptAmp = 0;
		for (i = 0; i < this.config.wallBoxList.length; i++) {
			// switch of boxes and adjust local limits
			if (Wallbox[i].SetOptAllow == false) {
				// Switch of imediately
				Wallbox[i].SetAllow = false;
				Wallbox[i].SetAmp = Wallbox[i].MinAmp;
				this.log.debug(`Charge Limiter: Wallbox ${i} verified for switch off`);
			} else {
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
				} else {
					// not enough current available, throttled charge
					if (this.config.maxAmpTotal - TotalSetOptAmp >= Wallbox[i].MinAmp) {
						// still enough above min current?
						Wallbox[i].SetAmp = this.config.maxAmpTotal - TotalSetOptAmp;
						Wallbox[i].SetAllow = true;
						this.log.debug(`Charge Limiter: Wallbox ${i} verified throttled charge with ${Wallbox[i].SetAmp}A`);
						TotalSetOptAmp = TotalSetOptAmp + Wallbox[i].SetAmp;
					} else {
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
	private async Charge_Config(): Promise<void> {
		let i = 0;
		for (i = 0; i < this.config.wallBoxList.length; i++) {
			if (Wallbox[i].SetAllow == false) {
				// first switch off boxes
				try {
					this.setForeignState(this.config.wallBoxList[i].stateChargeAllowed, Wallbox[i].SetAllow);
					this.setForeignState(this.config.wallBoxList[i].stateChargeCurrent, Number(Wallbox[i].SetAmp));
					// evtl. FEEDBACK ABFRAGEN!
				} catch (error) {
					this.log.error(`Charger Config: Error in setting values for wallbox ${i}: ${error}`);
				} // END try-catch
				this.log.debug(`Charger Config: Shutdown Wallbox ${i} - ${Wallbox[i].SetAmp} Ampere`);
			} else if (TotalMeasuredChargeCurrent + (Wallbox[i].SetAmp - Wallbox[i].MeasuredMaxChargeAmp) <= this.config.maxAmpTotal) {
				// HIER FEHLT NOCH DIE DEAKTIVIERUNG NICHT VORHANDENER AUTOS!!!
				try {
					this.setForeignState(this.config.wallBoxList[i].stateChargeCurrent, Number(Wallbox[i].SetAmp));
					this.setForeignState(this.config.wallBoxList[i].stateChargeAllowed, Wallbox[i].SetAllow);
				} catch (error) {
					this.log.error(`Charger Config: Error in setting charging for wallbox ${i}: ${error}`);
				} // END try-catch
				this.log.debug(`Charger Config: Wallbox ${i} switched on for charge with ${Wallbox[i].SetAmp}A`);
			}
		} // END for
	} // END Charge_Config

	/*****************************************************************************************/
	private async Calc_Total_Power(): Promise<any> {
		let i = 0;
		//this.log.debug(`Get charge power of all wallboxes`);
		TotalChargePower = 0;
		TotalMeasuredChargeCurrent = 0;
		try {
			for (i = 0; i < this.config.wallBoxList.length; i++) {
				Wallbox[i].ChargePower = await this.projectUtils.asyncGetForeignStateVal(this.config.wallBoxList[i].stateActiveChargePower);
				Wallbox[i].MeasuredMaxChargeAmp = await this.projectUtils.asyncGetForeignStateVal(this.config.wallBoxList[i].stateActiveChargeAmp);
				//this.log.debug(`Got charge power of wallbox ${i}: ${Wallbox[i].ChargePower} W; ${Wallbox[i].MeasuredMaxChargeAmp} A`);
				TotalChargePower += Wallbox[i].ChargePower;
				TotalMeasuredChargeCurrent += Math.ceil(Wallbox[i].MeasuredMaxChargeAmp);
			}
			this.setState("Power.Charge", TotalChargePower, true); // trim to Watt
			this.log.debug(`Total measured charge power: ${TotalChargePower}W - Total measured charge current: ${TotalMeasuredChargeCurrent}A`);
		} catch (error) {
			this.log.error(`Error in reading charge power of wallboxes: ${error}`);
		} // END catch
	} // END Calc_Total_Power
} // END Class

/*****************************************************************************************/
if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new ChargeMaster(options);
} else {
	// otherwise start the instance directly
	new ChargeMaster();
}
