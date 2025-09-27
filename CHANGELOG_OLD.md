![Logo](admin/chargemaster.png)

# ioBroker.chargemaster

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.chargemaster.svg?color=red&label=beta)
![Stable](https://iobroker.live/badges/chargemaster-stable.svg)
![Installed](https://iobroker.live/badges/chargemaster-installed.svg)

[![NPM](https://nodei.co/npm/iobroker.chargemaster.png?downloads=true)](https://nodei.co/npm/iobroker.chargemaster/)

## Adapter to manage one or multiple EV-chargers with use of PV-energy

Adapter to manage one or multiple EV-chargers (wallboxes) with use of PV-energy. Adapter currently handles with up to 3 EV wallboxes to manage charging available grid power with potential use of PV surplus energy.

## Changelog - OLD CHANGES

### 0.13.1 (2025-03-06)

- (HombachC) bump dependencies

### 0.13.0 (2025-02-23)

- (HombachC) bump needed admin to 7.4.10 as recommended by ioBroker (#623)

### 0.12.9 (2025-02-23)

- (HombachC) Bump @iobroker/adapter-dev to 1.4.0 (#621)
- (HombachC) Using "@alcalzone/release-script" (#624)

### 0.12.8 (2025-02-16)

- (HombachC) Sentry changes

### 0.12.7 (2025-01-01)

- (HombachC) year 2025 changes
- (HombachC) code optimisations

### 0.12.6 (2024-12-21)

- (HombachC) fix chai-as-promised

### 0.12.5 (2024-12-12)

- (HombachC) switch to i18n translation (#572)
- (HombachC) implement ioBroker.eslint-config (#580)

### 0.12.4 (2024-11-23)

- (HombachC) implement better state change error handling

### 0.12.3 (2024-11-18)

- (HombachC) fix bug in state subscription
- (HombachC) harmonize project tools

### 0.12.2 (2024-10-27)

- (HombachC) migrate eslint to >9.x

### 0.12.1 (2024-10-22)

- (HombachC) fix error in jsonConfig.json

### 0.12.0 (2024-10-22)

- (HombachC) BREAKING: dropped support for admin < 7 (#544)
- (HombachC) optimized responsive design (#544)
- (HombachC) optimized translation handling

### 0.11.1 (2024-09-16)

- (HombachC) add node.js 22 to the adapter testing matrix (#523)
- (HombachC) Bump @iobroker/testing to 5.0.0

### 0.11.0 (2024-08-29)

- (HombachC) implement variable wallbox amount
- (HombachC) fix errors in wallbox control
- (HombachC) complete rework of configuration screen
- (HombachC) move utils to extra class
- (HombachC) switch to ECMA 2022 code

### 0.10.0 (2024-08-18)

- (HombachC) switch to Typescript
- (HombachC) change adapter type to "energy"
- (HombachC) replace deprecated setStateAsync

### 0.9.3 (2024-08-18)

- (HombachC) change translation handling
- (HombachC) code and repository cleanup
- (HombachC) prepare switch to Typescript

### 0.9.2 (2024-08-16)

- (HombachC) fixed vulnerability in dependency
- (HombachC) added tests for node 22

### 0.9.1 (2024-08-06)

- (HombachC) fixed issues detected by repository checker (#494)
- (HombachC) code cleanups

### 0.9.0 (2024-04-20)

- (HombachC) BREAKING: dropped support for node.js 16 (#455)
- (HombachC) BREAKING: js-controller >= 5 is required (#456)

### 0.8.5 (2024-03-27)

- (HombachC) updated CI definitions, switched to node 20 as main test scenario
- (HombachC) corrected io-package.json according to new schema

### 0.8.4 (2023-12-29)

- (HombachC) BREAKING: dropped support for js-controller 3.x
- (HombachC) Year 2024 changes
- (HombachC) Bump axios to 1.6.3 because of vulnerability

### 0.8.3 (2023-10-29)

- (HombachC) Bumb adapter core to 3.x
- (HombachC) Bump axios to 1.6.0 because of vulnerability

### 0.8.2 (2023-10-01)

- (HombachC) Several dependency updates
- (HombachC) Fixed acknowledging of state changes (#339)

### 0.8.1 (2023-08-29)

- (HombachC) bumped dependencies, added min/max to settings state defaults

### 0.8.0 (2023-06-23)

- (HombachC) changed config screen to admin 5 solution

### 0.7.2 (2023-06-19)

- (HombachC) Removed Travis

### 0.7.1 (2023-06-13)

- (HombachC) Fixed typo in docu, added translations

### 0.7.0 (2023-06-11)

- (HombachC) BREAKING: dropped node.js 14 support
- (HombachC) Add tests for node.js 20, removed for node.js 14, bumped dependencies
- (HombachC) BREAKING: dropped ioBroker.admin 4 support

### 0.6.3 (2022-12-29)

- (HombachC) bumped dependencies and year 2023 changes

### 0.6.2 (2022-09-11)

- (HombachC) fixed error in calc with active charge current

### 0.6.1 (2022-09-08)

- (HombachC) bump @iobroker/testing from 3.0.2 to 4.1.0

### 0.6.0 (2022-08-09)

- (HombachC) fix error in max total current, fix error in charge manager

### 0.5.1 (2022-06-06)

- (HombachC) removed gulp, bumped dependencies, small code tweaks

### 0.5.0 (2022-05-09)

- (HombachC) BREAKING: dropped node.js 12 support
- (HombachC) Add tests for node.js 18, removed for node.js 12
- (HombachC) bumped dependencies to non node.js 12 support

### 0.4.4 (2022-04-27)

- (HombachC) fixed vulnerability

### 0.4.3 (2022-02-22)

- (HombachC) added github tests for MAC-OS and Windows

### 0.4.2 (2022-02-21)

- (HombachC) changed statemachine to async; bumped dependencies

### 0.4.1 (2022-18-18)

- (HombachC) fixed error in charger communication; added ci test

### 0.4.0 (2022-02-14)

- (HombachC) introduced automatic adaption to the amount of configured chargers; bugfixes for cleaner run without config

### 0.3.2 (2022-02-14)

- (HombachC) fixing test automation, several bugfixes for cleaner run without config

### 0.3.1 (2022-01-29)

- (HombachC) added sentry statistics; optimized logging; fixed type conversion bug

### 0.3.0 (2022-01-28)

- (HombachC) first public release for iOBroker latest repo; added sentry support

### 0.2.0 (2021-12-18)

- (HombachC) dropped node.js 10 support; bumped dependencies

### 0.1.5 (2021-10-15)

- (HombachC) fixed vulnerability; improved docu

### 0.1.2 (2021-05-02)

- (HombachC) code cleanup and optimization, fixed onStateChange

### 0.1.1 (2021-04-30)

- (HombachC) fixed errors with js-controller 3.3.x, bumped dependencies

### 0.1.0 (2021-04-11)

- (HombachC) first running version, fixed to 3 boxes

### 0.0.7 (2021-03-31)

- (HombachC) added MaxAmpTotal, MinAmpWallBox, MaxAmpWallBox

### 0.0.6 (2021-03-23)

- (HombachC) added collection and calc of total charge power

### 0.0.4 (2021-03-15)

- (HombachC) fix error in foreign state popup

### 0.0.2 (2021-01-06)

- (HombachC) fix errors to get it running in old single wallbox mode

### 0.0.1 (2021-01-01)

- (HombachC) initial release
