![Logo](admin/chargemaster.png)

# ioBroker.chargemaster

## Versions

![Beta](https://img.shields.io/npm/v/iobroker.chargemaster.svg?color=red&label=beta)
![Stable](https://iobroker.live/badges/chargemaster-stable.svg)
![Installed](https://iobroker.live/badges/chargemaster-installed.svg)

[![NPM](https://nodei.co/npm/iobroker.chargemaster.png?downloads=true)](https://nodei.co/npm/iobroker.chargemaster/)

## Adapter to manage one or multiple EV-chargers with use of PV-energy

Adapter to manage one or multiple EV-chargers (wallboxes) with use of PV-energy. Adapter currently handles with up to 3 EV wallboxes to manage charging available grid power  with potential use of PV surplus energy. 

## Changelog - OLD CHANGES

### 0.7.0 (2023-06-11)

-   (HombachC) BREAKING: dropped node.js 14 support
-   (HombachC) Add tests for node.js 20, removed for node.js 14, bumped dependencies
-   (HombachC) BREAKING: dropped ioBroker.admin 4 support

### 0.6.3 (2022-12-29)

-   (HombachC) bumped dependencies and year 2023 changes

### 0.6.2 (2022-09-11)

-   (HombachC) fixed error in calc with active charge current

### 0.6.1 (2022-09-08)

-   (HombachC) bump @iobroker/testing from 3.0.2 to 4.1.0

### 0.6.0 (2022-08-09)

-   (HombachC) fix error in max total current, fix error in charge manager

### 0.5.1 (2022-06-06)

-   (HombachC) removed gulp, bumped dependencies, small code tweaks

### 0.5.0 (2022-05-09)

-   (HombachC) BREAKING: dropped node.js 12 support
-   (HombachC) Add tests for node.js 18, removed for node.js 12
-   (HombachC) bumped dependencies to non node.js 12 support

### 0.4.4 (2022-04-27)

-   (HombachC) fixed vulnerability, bumped dependencies

### 0.4.3 (2022-02-22)

-   (HombachC) added github tests for MAC-OS and Windows

### 0.4.2 (2022-02-21)

-   (HombachC) changed statemachine to async; bumped dependencies

### 0.4.1 (2022-18-18)

-   (HombachC) fixed error in charger communication; added ci test

### 0.4.0 (2022-02-14)

-   (HombachC) introduced automatic adaption to the amount of configured chargers; bugfixes for cleaner run without config

### 0.3.2 (2022-02-14)

-   (HombachC) fixing test automation, several bugfixes for cleaner run without config

### 0.3.1 (2022-01-29)

-   (HombachC) added sentry statistics; optimized logging; fixed type conversion bug

### 0.3.0 (2022-01-28)

-   (HombachC) first public release for iOBroker latest repo; added sentry support

### 0.2.0 (2021-12-18)

-   (HombachC) dropped node.js 10 support; bumped dependencies

### 0.1.5 (2021-10-15)

-   (HombachC) fixed vulnerability; improved docu

### 0.1.2 (2021-05-02)

-   (HombachC) code cleanup and optimization, fixed onStateChange

### 0.1.1 (2021-04-30)

-   (HombachC) fixed errors with js-controller 3.3.x, bumped dependencies

### 0.1.0 (2021-04-11)

-   (HombachC) first running version, fixed to 3 boxes

### 0.0.7 (2021-03-31)

-   (HombachC) added MaxAmpTotal, MinAmpWallBox, MaxAmpWallBox

### 0.0.6 (2021-03-23)

-   (HombachC) added collection and calc of total charge power

### 0.0.4 (2021-03-15)

-   (HombachC) fix error in foreign state popup

### 0.0.2 (2021-01-06)

-   (HombachC) fix errors to get it running in old single wallbox mode

### 0.0.1 (2021-01-01)

-   (HombachC) initial release

## Tested with
- 3x go-E Charger & Kostal PikoBA

## License
MIT License

Copyright (c) 2021-2024 Christian Hombach

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
