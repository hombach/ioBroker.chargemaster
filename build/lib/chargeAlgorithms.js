"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VOLTAGE = exports.RESERVE = exports.MAX_BAT_DISCHARGE = void 0;
exports.planWallboxCharge = planWallboxCharge;
exports.limitTotalCurrent = limitTotalCurrent;
exports.MAX_BAT_DISCHARGE = 2000;
exports.RESERVE = 100;
exports.VOLTAGE = 230;
function planWallboxCharge(wallbox, input, log = () => undefined) {
    const usableBatRange = 100 - input.minHomeBatSoC;
    const batDischargePower = usableBatRange > 0 ? (exports.MAX_BAT_DISCHARGE / usableBatRange) * (input.batSoC - input.minHomeBatSoC) : 0;
    let optAmpere = Math.floor((input.solarPower - input.houseConsumption + exports.RESERVE + batDischargePower) / exports.VOLTAGE);
    optAmpere = Math.min(optAmpere, wallbox.MaxAmp);
    optAmpere = Math.max(optAmpere, 0);
    log(`Charge Manager: Optimal charging current of Wallbox ${wallbox.ID} would be: ${optAmpere} A`);
    if (wallbox.SetOptAmp < optAmpere) {
        wallbox.SetOptAmp++;
    }
    else if (wallbox.SetOptAmp > optAmpere) {
        wallbox.SetOptAmp--;
    }
    log(`Charge Manager: Wallbox ${wallbox.ID} blended current: ${wallbox.SetOptAmp} A; ` +
        `Solar power: ${input.solarPower} W; ` +
        `House consumption: ${input.houseConsumption} W; ` +
        `Total charger power: ${input.totalChargePower ?? 0} W`);
    if (wallbox.SetOptAmp > wallbox.MinAmp + wallbox.CurrentHysteresis) {
        wallbox.SetOptAllow = true;
    }
    else if (wallbox.SetOptAmp < wallbox.MinAmp) {
        wallbox.DelayOff++;
        if (wallbox.DelayOff > 15) {
            wallbox.SetOptAllow = false;
            wallbox.DelayOff = 0;
        }
    }
    log(`Charge Manager: Wallbox ${wallbox.ID} planned state: ${wallbox.SetOptAllow}`);
}
function limitTotalCurrent(wallboxInfoList, maxAmpTotal, log = () => undefined) {
    let TotalSetOptAmp = 0;
    wallboxInfoList
        .filter(wallbox => !wallbox.SetOptAllow)
        .forEach(wallbox => {
        wallbox.SetAllow = false;
        wallbox.SetAmp = wallbox.MinAmp;
        log(`Charge Limiter: Wallbox ${wallbox.ID} switched off due to SetOptAllow being false`);
    });
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
        }
        else {
            if (maxAmpTotal - TotalSetOptAmp >= wallbox.MinAmp) {
                wallbox.SetAmp = maxAmpTotal - TotalSetOptAmp;
                wallbox.SetAllow = true;
                log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) verified throttled charge with ${wallbox.SetAmp}A`);
                TotalSetOptAmp += wallbox.SetAmp;
            }
            else {
                wallbox.SetAmp = wallbox.MinAmp;
                wallbox.SetAllow = false;
                log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeNOW) switched off due to not enough remaining total current`);
            }
        }
    });
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
        }
        else {
            if (maxAmpTotal - TotalSetOptAmp >= wallbox.MinAmp) {
                wallbox.SetAmp = maxAmpTotal - TotalSetOptAmp;
                wallbox.SetAllow = true;
                log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) verified throttled charge with ${wallbox.SetAmp}A`);
                TotalSetOptAmp += wallbox.SetAmp;
            }
            else {
                wallbox.SetAmp = wallbox.MinAmp;
                wallbox.SetAllow = false;
                log(`Charge Limiter: Wallbox ${wallbox.ID} (ChargeManager) switched off due to not enough remaining total current`);
            }
        }
    });
}
//# sourceMappingURL=chargeAlgorithms.js.map