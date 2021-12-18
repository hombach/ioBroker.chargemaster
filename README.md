![Logo](admin/chargemaster.png)
# ioBroker.chargemaster

[![NPM version](http://img.shields.io/npm/v/iobroker.chargemaster.svg)](https://www.npmjs.com/package/iobroker.chargemaster)
[![Downloads](https://img.shields.io/npm/dm/iobroker.chargemaster.svg)](https://www.npmjs.com/package/iobroker.chargemaster)
![Number of Installations (latest)](http://ioBroker.live/badges/template-installed.svg)
![Number of Installations (stable)](http://ioBroker.live/badges/template-stable.svg)
[![Dependency Status](https://img.shields.io/david/hombach/ioBroker.chargemaster.svg)](https://david-dm.org/hombach/ioBroker.chargemaster)
[![Known Vulnerabilities](https://snyk.io/test/github/hombach/ioBroker.chargemaster/badge.svg)](https://snyk.io/test/github/hombach/ioBroker.chargemaster)
![Node.js CI](https://github.com/hombach/ioBroker.chargemaster/workflows/Node.js%20CI/badge.svg)

[![NPM](https://nodei.co/npm/iobroker.chargemaster.png?downloads=true)](https://nodei.co/npm/iobroker.chargemaster/)

Travis CI-Tests: [![Travis-CI](http://img.shields.io/travis/hombach/ioBroker.chargemaster/master.svg)](https://travis-ci.org/hombach/ioBroker.chargemaster)

Appveyor CI-Tests: [![Appveyor-CI](https://ci.appveyor.com/api/projects/status/github/hombach/ioBroker.chargemaster?branch=master&svg=true)](https://ci.appveyor.com/project/hombach/iobroker-chargemaster)

[![NPM](https://nodei.co/npm/iobroker.chargemaster.png?downloads=true)](https://nodei.co/npm/iobroker.chargemaster/)

## Adapter for managing of multi EV-chargers with use of PV-energy
Adapter for managing of multi EV-chargers (wallboxes) with use of PV-energy. Adapter handles with up to 3 EV wallboxes to manage charging by potential use of PV energy

## Settings
To connect to the wallboxes type in the states with needed data in the config.

## Changelog
! Note that missing version entries are typically dependency updates for security.
### 0.2.0 (18.12.2021)
* (HombachC) dropped node.js 10 support; bumped dependencies
### 0.1.5 (15.10.2021)
* (HombachC) fixed vulnerability; improved docu
### 0.1.2 (02.05.2021)
* (HombachC) code cleanup and optimization, fixed onStateChange
### 0.1.1 (30.04.2021)
* (HombachC) fixed errors with js-controller 3.3.x, bumped dependencies
### 0.1.0 (11.04.2021)
* (HombachC) first running version, fixed to 3 boxes
### 0.0.7 (31.03.2021)
* (HombachC) added MaxAmpTotal, MinAmpWallBox, MaxAmpWallBox
### 0.0.6 (23.03.2021)
* (HombachC) added collection and calc of total charge power
### 0.0.5 (21.03.2021)
* (HombachC) fixed to box 2
### 0.0.4 (15.03.2021)
* (HombachC) fix error in foreign state popup
### 0.0.2 (06.01.2021)
* (HombachC) fix errors to get it running in old single wallbox mode
### 0.0.1 (01.01.2021)
* (HombachC) initial release

## License
MIT License

Copyright (c) 2021 Christian Hombach

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