import type { IWallboxInfo } from "./projectUtils";

/** maximum power in watts the home battery may contribute to wallbox charging */
export const MAX_BAT_DISCHARGE = 2000;
/** power reserve in watts kept as safety margin in the surplus calculation */
export const RESERVE = 100;
/** mains voltage used to convert power to current */
export const VOLTAGE = 230;

/**
 * IChargePlanInput
 * Snapshot of the current energy situation used to plan the charging of a wallbox.
 */
export interface IChargePlanInput {
	/** current solar production in W */
	solarPower: number;
	/** current house power consumption in W */
	houseConsumption: number;
	/** current home battery state of charge in % */
	batSoC: number;
	/** minimum home battery SoC setpoint in % */
	minHomeBatSoC: number;
	/** total measured charge power of all wallboxes in W - only used for logging */
	totalChargePower?: number;
}

/**
 * Plans the charging of a single wallbox based on the current energy situation.
 *
 * Calculates the optimal charging current from solar surplus plus an allowed home battery
 * discharge share, then blends `SetOptAmp` towards it by 1 A per call. Charging is enabled
 * once `SetOptAmp` exceeds `MinAmp` plus hysteresis and disabled only after more than 15
 * consecutive calls below `MinAmp` (delayed switch-off).
 *
 * @param wallbox - The wallbox info object to update (SetOptAmp, SetOptAllow, DelayOff are modified in place)
 * @param input - Snapshot of the current energy situation
 * @param log - Optional callback receiving debug log messages
 */
export function planWallboxCharge(wallbox: IWallboxInfo, input: IChargePlanInput, log: (msg: string) => void = () => undefined): void {
	// allowed battery discharge power scales linearly from 0 at minHomeBatSoC to MAX_BAT_DISCHARGE at 100% SoC;
	// with a setpoint of 100% there is no usable band, so no battery discharge is allowed
	const usableBatRange = 100 - input.minHomeBatSoC;
	const batDischargePower = usableBatRange > 0 ? (MAX_BAT_DISCHARGE / usableBatRange) * (input.batSoC - input.minHomeBatSoC) : 0;
	let optAmpere = Math.floor((input.solarPower - input.houseConsumption + RESERVE + batDischargePower) / VOLTAGE);
	optAmpere = Math.min(optAmpere, wallbox.MaxAmp); // limiting to max current of single box - global will be limited later
	optAmpere = Math.max(optAmpere, 0); // don't ramp below zero - avoids long recovery when solar power returns
	log(`Charge Manager: Optimal charging current of Wallbox ${wallbox.ID} would be: ${optAmpere} A`);
	if (wallbox.SetOptAmp < optAmpere) {
		wallbox.SetOptAmp++;
	} else if (wallbox.SetOptAmp > optAmpere) {
		wallbox.SetOptAmp--;
	}
	log(
		`Charge Manager: Wallbox ${wallbox.ID} blended current: ${wallbox.SetOptAmp} A; ` +
			`Solar power: ${input.solarPower} W; ` +
			`House consumption: ${input.houseConsumption} W; ` +
			`Total charger power: ${input.totalChargePower ?? 0} W`,
	);
	if (wallbox.SetOptAmp > wallbox.MinAmp + wallbox.CurrentHysteresis) {
		wallbox.SetOptAllow = true; // ON and current because higher than MinAmp + hysteresis
	} else if (wallbox.SetOptAmp < wallbox.MinAmp) {
		wallbox.DelayOff++;
		if (wallbox.DelayOff > 15) {
			wallbox.SetOptAllow = false; // Off
			wallbox.DelayOff = 0;
		}
	}
	log(`Charge Manager: Wallbox ${wallbox.ID} planned state: ${wallbox.SetOptAllow}`);
}

/**
 * Limits the planned charging currents of a list of wallboxes to the global maximum total current.
 *
 * 1. **Disables Wallboxes with `SetOptAllow` set to false:**
 *    - Iterates through wallboxes with `SetOptAllow` set to `false` and turns them off immediately. Sets their `SetAmp` to the minimum allowed value.
 * 2. **Processes Wallboxes with `ChargeNOW` set to true:**
 *    - For wallboxes that are allowed (`SetOptAllow` is `true`) and have `ChargeNOW` set to `true`, it attempts to allocate as much current as possible based on their `SetOptAmp` value.
 *    - If the total requested current exceeds the maximum allowed (`maxAmpTotal`), it adjusts the current allocation to fit within the limit.
 *    - If there is not enough remaining current to meet the wallbox's minimum requirement, it turns off the wallbox.
 * 3. **Handles Remaining Wallboxes with `ChargeManager`:**
 *    - For wallboxes that are allowed (`SetOptAllow` is `true`), do not have `ChargeNOW` set to `true`, but have a `ChargeManager`, it attempts to allocate current as available.
 *    - Similar to the second step, it adjusts the allocation if the total exceeds the maximum allowed current and turns off the wallbox if not enough current is available.
 *
 * @param wallboxInfoList - List of wallbox info objects to update (SetAmp and SetAllow are modified in place)
 * @param maxAmpTotal - Maximum allowed total current in A over all wallboxes
 * @param log - Optional callback receiving debug log messages
 */
export function limitTotalCurrent(wallboxInfoList: IWallboxInfo[], maxAmpTotal: number, log: (msg: string) => void = () => undefined): void {
	let TotalSetOptAmp = 0;

	// First loop: Wallboxes with SetOptAllow = false (shall be turned off immediately)
	wallboxInfoList
		.filter(wallbox => !wallbox.SetOptAllow)
		.forEach(wallbox => {
			wallbox.SetAllow = false;
			wallbox.SetAmp = wallbox.MinAmp;
			log(`Charge Limiter: Wallbox ${wallbox.ID} switched off due to SetOptAllow being false`);
		});

	// Second loop: Wallboxes with ChargeNOW = true (enable as much current as available)
	wallboxInfoList
		.filter(wallbox => wallbox.SetOptAllow && wallbox.ChargeNOW)
		.forEach(wallbox => {
			if (wallbox.SetOptAmp > maxAmpTotal) {
				wallbox.SetOptAmp = maxAmpTotal;
			}
			if (TotalSetOptAmp + wallbox.SetOptAmp <= maxAmpTotal) {
				wallbox.SetAmp = wallbox.SetOptAmp;
				wallbox.SetAllow = true;
				log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) verified charge with ${wallbox.SetAmp}A`);
				TotalSetOptAmp += wallbox.SetAmp;
			} else {
				if (maxAmpTotal - TotalSetOptAmp >= wallbox.MinAmp) {
					wallbox.SetAmp = maxAmpTotal - TotalSetOptAmp;
					wallbox.SetAllow = true;
					log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) verified throttled charge with ${wallbox.SetAmp}A`);
					TotalSetOptAmp += wallbox.SetAmp;
				} else {
					wallbox.SetAmp = wallbox.MinAmp;
					wallbox.SetAllow = false;
					log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) switched off due to not enough remaining total current`);
				}
			}
		});

	// Third loop: Remaining wallboxes without ChargeNOW, so boxes with ChargeManager
	wallboxInfoList
		.filter(wallbox => wallbox.SetOptAllow && !wallbox.ChargeNOW && wallbox.ChargeManager)
		.forEach(wallbox => {
			if (wallbox.SetOptAmp > maxAmpTotal) {
				wallbox.SetOptAmp = maxAmpTotal;
			}
			if (TotalSetOptAmp + wallbox.SetOptAmp <= maxAmpTotal) {
				wallbox.SetAmp = wallbox.SetOptAmp;
				wallbox.SetAllow = true;
				log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) verified charge with ${wallbox.SetAmp}A`);
				TotalSetOptAmp += wallbox.SetAmp;
			} else {
				if (maxAmpTotal - TotalSetOptAmp >= wallbox.MinAmp) {
					wallbox.SetAmp = maxAmpTotal - TotalSetOptAmp;
					wallbox.SetAllow = true;
					log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) verified throttled charge with ${wallbox.SetAmp}A`);
					TotalSetOptAmp += wallbox.SetAmp;
				} else {
					wallbox.SetAmp = wallbox.MinAmp;
					wallbox.SetAllow = false;
					log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) switched off due to not enough remaining total current`);
				}
			}
		});
}
