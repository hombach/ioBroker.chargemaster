// This will be called by the admin adapter when the settings page loads
function load(settings, onChange) {
    // example: select elements with id=key and class=value and insert value
    if (!settings) return;
    $('.value').each(function () {
        var $key = $(this);
        var id = $key.attr('id');
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id])
                .on('change', () => onChange())
                ;
        } else {
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(settings[id])
                .on('change', () => onChange())
                .on('keyup', () => onChange())
                ;
        }
    });

    // NEW, NOT WORKING
    $('#StateHomeSolarPowerPopUp').on('click', function () {
        initSelectId(function (sid) {
            sid.selectId('show', $('#StateHomeSolarPower').val(), function (newId) {
                if (newId) {
                    $('#StateHomeSolarPower').val(newId).trigger('change');
                }
            });
        });
    });

    $('#StateHomeBatSocPopUp').on('click', function () {
        window.alert("StateHomeBatSocPopUp pressed:   " + $('#StateHomeBatSoc').val());
        initSelectId(function (sid) {
            sid.selectId('show', $('#StateHomeBatSoc').val(), function (newId) {
                if (newId) {
                    window.alert("NewID!!");
                    $('#StateHomeBatSoc').val(newId).trigger('change');
                }
            });
        });
    });

    $('#StateHomePowerConsumptionPopUp').on('click', function () {
        initSelectId(function (sid) {
            sid.selectId('show', $('#StateHomePowerConsumption').val(), function (newId) {
                if (newId) {
                    $('#StateHomePowerConsumption').val(newId).trigger('change');
                }
            });
        });
    });

    $('#StateWallBox1ChargeCurrentPopUp').on('click', function () {
        initSelectId(function (sid) {
            sid.selectId('show', $('#StateWallBox1ChargeCurrent').val(), function (newId) {
                if (newId) {
                    $('#StateWallBox1ChargeCurrent').val(newId).trigger('change');
                }
            });
        });
    });

    $('#StateWallBox1ChargeAllowedPopUp').on('click', function () {
        initSelectId(function (sid) {
            sid.selectId('show', $('#StateWallBox1ChargeAllowed').val(), function (newId) {
                if (newId) {
                    $('#StateWallBox1ChargeAllowed').val(newId).trigger('change');
                }
            });
        });
    });

    // END NEW  */





    onChange(false);
    // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
    if (M) M.updateTextFields();
}


// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    // example: select elements with class=value and build settings object
    var obj = {};
    $('.value').each(function () {
        var $this = $(this);
        if ($this.attr('type') === 'checkbox') {
            obj[$this.attr('id')] = $this.prop('checked');
        } else {
            obj[$this.attr('id')] = $this.val();
        }
    });
    callback(obj);
}


// NEW from BlueFox, Not Working
//      var selectId;
function initSelectId(callback) {
    if (selectId) return callback(selectId);
    window.alert("function initSelectId entered");
    socket.emit('getObjects', function (err, objs) {
        selectId = $('#dialog-select-member').selectId('init', {
            noMultiselect: true,
            objects: objs,
            imgPath: '../../lib/css/fancytree/',
            name: 'select-foreign-state',
        });
        window.alert("Error: " + err);
        window.alert(objs);
        callback(selectId);
    });
}

/*
function initSelectId(cb) {
    if (selectId) return cb(selectId);
    window.alert("initSelectId");
    socket.emit('getObjects', function (err, res) {
        if (!err && res) {
            selectId = $('#dialog-select-member').selectId('init', {
                noMultiselect: true,
                objects: res,
                imgPath: '../../lib/css/fancytree/',
                filter: { type: 'state' },
                name: 'select-foreign-state',
                texts: {
                    select: _('Select'),
                    cancel: _('Cancel'),
                    all: _('All'),
                    id: _('ID'),
                    name: _('Name'),
                    role: _('Role'),
                    room: _('Room'),
                    value: _('Value'),
                    selectid: _('Select ID'),
                    from: _('From'),
                    lc: _('Last changed'),
                    ts: _('Time stamp'),
                    wait: _('Processing...'),
                    ack: _('Acknowledged'),
                    selectAll: _('Select all'),
                    unselectAll: _('Deselect all'),
                    invertSelection: _('Invert selection')
                },
                columns: ['image', 'name', 'role', 'room']
            });
            window.alert("Error: " + err);
            window.alert(res);
            cb && cb(selectId);
        }
    });
}
// END NEW */