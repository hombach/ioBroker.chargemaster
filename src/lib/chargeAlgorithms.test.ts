import { strict as assert } from "node:assert";
import { limitTotalCurrent, planWallboxCharge } from "./chargeAlgorithms";
import type { IWallboxInfo } from "./projectUtils";

function createWallbox(overrides: Partial<IWallboxInfo> = {}): IWallboxInfo {
	return {
		ID: 0,
		ChargeNOW: false,
		ChargeManager: false,
		ChargeCurrent: 6,
		ChargePower: 0,
		MeasuredMaxChargeAmp: 0,
		MinAmp: 6,
		MaxAmp: 16,
		DelayOff: 0,
		CurrentHysteresis: 3,
		SetOptAmp: 5,
		SetOptAllow: false,
		SetAmp: 0,
		SetAllow: false,
		...overrides,
	};
}

describe("chargeAlgorithms => planWallboxCharge", () => {
	it("ramps SetOptAmp up by 1 A per cycle towards the optimal current", () => {
		const wallbox = createWallbox({ SetOptAmp: 5 });
		planWallboxCharge(wallbox, { solarPower: 5000, houseConsumption: 500, batSoC: 100, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 6);
	});

	it("ramps SetOptAmp down by 1 A per cycle towards the optimal current", () => {
		const wallbox = createWallbox({ SetOptAmp: 10 });
		planWallboxCharge(wallbox, { solarPower: 0, houseConsumption: 500, batSoC: 80, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 9);
	});

	it("keeps SetOptAmp when the optimal current is reached", () => {
		// optAmpere = floor((2700 - 500 + 100 + 0) / 230) = 10
		const wallbox = createWallbox({ SetOptAmp: 10 });
		planWallboxCharge(wallbox, { solarPower: 2700, houseConsumption: 500, batSoC: 80, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 10);
	});

	it("limits the optimal current to the wallbox maximum", () => {
		const wallbox = createWallbox({ SetOptAmp: 16, MaxAmp: 16 });
		planWallboxCharge(wallbox, { solarPower: 20000, houseConsumption: 0, batSoC: 100, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 16);
	});

	it("does not ramp below zero even with high consumption", () => {
		const wallbox = createWallbox({ SetOptAmp: 0 });
		planWallboxCharge(wallbox, { solarPower: 0, houseConsumption: 5000, batSoC: 80, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 0);
	});

	it("allows no battery discharge with a setpoint of 100% (no NaN)", () => {
		// usable battery band is empty - term must be 0, not NaN from division by zero
		const wallbox = createWallbox({ SetOptAmp: 0 });
		planWallboxCharge(wallbox, { solarPower: 0, houseConsumption: 0, batSoC: 100, minHomeBatSoC: 100 });
		assert.equal(wallbox.SetOptAmp, 0);
		assert.equal(Number.isNaN(wallbox.SetOptAmp), false);
	});

	it("adds the allowed battery discharge share to the surplus", () => {
		// batDischargePower = (2000 / 20) * (90 - 80) = 1000 W
		// optAmpere = floor((0 - 0 + 100 + 1000) / 230) = 4
		const wallbox = createWallbox({ SetOptAmp: 3 });
		planWallboxCharge(wallbox, { solarPower: 0, houseConsumption: 0, batSoC: 90, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 4);
	});

	it("enables charging above MinAmp plus hysteresis", () => {
		const wallbox = createWallbox({ SetOptAmp: 10, MinAmp: 6, CurrentHysteresis: 3, SetOptAllow: false });
		planWallboxCharge(wallbox, { solarPower: 10000, houseConsumption: 0, batSoC: 100, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 11);
		assert.equal(wallbox.SetOptAllow, true);
	});

	it("keeps the current state inside the hysteresis band", () => {
		// SetOptAmp ends at 9 which is neither above MinAmp + hysteresis (9) nor below MinAmp (6)
		const wallbox = createWallbox({ SetOptAmp: 8, SetOptAllow: true });
		planWallboxCharge(wallbox, { solarPower: 2700, houseConsumption: 500, batSoC: 80, minHomeBatSoC: 80 });
		assert.equal(wallbox.SetOptAmp, 9);
		assert.equal(wallbox.SetOptAllow, true);
		assert.equal(wallbox.DelayOff, 0);
	});

	it("switches off only after more than 15 consecutive cycles below MinAmp", () => {
		const wallbox = createWallbox({ SetOptAmp: 3, SetOptAllow: true });
		const input = { solarPower: 0, houseConsumption: 2000, batSoC: 80, minHomeBatSoC: 80 };
		for (let cycle = 1; cycle <= 15; cycle++) {
			planWallboxCharge(wallbox, input);
			assert.equal(wallbox.SetOptAllow, true, `still on after cycle ${cycle}`);
		}
		planWallboxCharge(wallbox, input); // 16th cycle below MinAmp switches off
		assert.equal(wallbox.SetOptAllow, false);
		assert.equal(wallbox.DelayOff, 0);
	});
});

describe("chargeAlgorithms => limitTotalCurrent", () => {
	it("switches off wallboxes that are not allowed", () => {
		const wallbox = createWallbox({ SetOptAllow: false, SetAllow: true, SetAmp: 16 });
		limitTotalCurrent([wallbox], 32);
		assert.equal(wallbox.SetAllow, false);
		assert.equal(wallbox.SetAmp, wallbox.MinAmp);
	});

	it("grants a ChargeNOW wallbox its requested current", () => {
		const wallbox = createWallbox({ ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 });
		limitTotalCurrent([wallbox], 32);
		assert.equal(wallbox.SetAllow, true);
		assert.equal(wallbox.SetAmp, 16);
	});

	it("caps a single wallbox at the global maximum", () => {
		const wallbox = createWallbox({ ChargeNOW: true, SetOptAllow: true, SetOptAmp: 20, MaxAmp: 32 });
		limitTotalCurrent([wallbox], 16);
		assert.equal(wallbox.SetAllow, true);
		assert.equal(wallbox.SetAmp, 16);
	});

	it("throttles the second ChargeNOW wallbox to the remaining current", () => {
		const wallbox0 = createWallbox({ ID: 0, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 });
		const wallbox1 = createWallbox({ ID: 1, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 });
		limitTotalCurrent([wallbox0, wallbox1], 24);
		assert.equal(wallbox0.SetAmp, 16);
		assert.equal(wallbox1.SetAllow, true);
		assert.equal(wallbox1.SetAmp, 8);
	});

	it("switches off the second wallbox when the remainder is below its minimum", () => {
		const wallbox0 = createWallbox({ ID: 0, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 });
		const wallbox1 = createWallbox({ ID: 1, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16, MinAmp: 6 });
		limitTotalCurrent([wallbox0, wallbox1], 20);
		assert.equal(wallbox0.SetAmp, 16);
		assert.equal(wallbox1.SetAllow, false);
		assert.equal(wallbox1.SetAmp, 6);
	});

	it("prioritizes ChargeNOW over ChargeManager wallboxes regardless of list order", () => {
		const managerBox = createWallbox({ ID: 0, ChargeManager: true, SetOptAllow: true, SetOptAmp: 16 });
		const nowBox = createWallbox({ ID: 1, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 });
		limitTotalCurrent([managerBox, nowBox], 20);
		assert.equal(nowBox.SetAllow, true);
		assert.equal(nowBox.SetAmp, 16);
		// only 4 A remain - below the manager box minimum of 6 A
		assert.equal(managerBox.SetAllow, false);
		assert.equal(managerBox.SetAmp, 6);
	});

	it("grants ChargeManager wallboxes the remaining current", () => {
		const nowBox = createWallbox({ ID: 0, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 10 });
		const managerBox = createWallbox({ ID: 1, ChargeManager: true, SetOptAllow: true, SetOptAmp: 16 });
		limitTotalCurrent([nowBox, managerBox], 20);
		assert.equal(nowBox.SetAmp, 10);
		assert.equal(managerBox.SetAllow, true);
		assert.equal(managerBox.SetAmp, 10);
	});

	it("keeps the total allocated current within the global maximum", () => {
		const boxes = [
			createWallbox({ ID: 0, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 }),
			createWallbox({ ID: 1, ChargeNOW: true, SetOptAllow: true, SetOptAmp: 16 }),
			createWallbox({ ID: 2, ChargeManager: true, SetOptAllow: true, SetOptAmp: 16 }),
		];
		limitTotalCurrent(boxes, 25);
		const totalAllocated = boxes.filter(wallbox => wallbox.SetAllow).reduce((sum, wallbox) => sum + wallbox.SetAmp, 0);
		assert.equal(totalAllocated <= 25, true, `allocated ${totalAllocated}A exceeds 25A`);
	});
});
