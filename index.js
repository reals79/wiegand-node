'use strict'

const EventEmitter = require('events')
const Gpio = require('onoff').Gpio
const TIMEOUT = parseInt(process.env.WIEGAND_TIMEOUT) || 25

function _reversHex (data) {
  let da = Buffer.from(data, 'hex');
  let buffer = Buffer.allocUnsafe(da.length)

  for (var i = 0, j = da.length - 1; i <= j; ++i, --j) {
    buffer[i] = da[j]
    buffer[j] = da[i]
  }

  var str = '';
  for(var i = 0; i < buffer.length ; i++) {
    str += ((buffer[i] < 16) ? '0' : '') + buffer[i].toString(16);
  }

  return str.toUpperCase();
}

function _rfid_format (value) {
  let str_value = value.toString();
  while (str_value.length < 10)
    str_value = '0' + str_value;
  return str_value;
}
class Wiegand extends EventEmitter {
  /**
   *
   * @emits keypad
   * @emits reader
   */
  constructor (options) {
    super()
    this.data = []
    this.timeout = null

    this.gpio = { d0: options.d0 || 4, d1: options.d1 || 17 }

    this.d0 = new Gpio(this.gpio.d0, 'in', 'rising')
    this.d1 = new Gpio(this.gpio.d1, 'in', 'rising')

    this.on('data', (data) => {
      switch (true) {
        case data.length >= 34:
          data = data.slice(0, 34)
          this._emitReader(data)
          break
        case data.length >= 26:
          data = data.slice(0, 26)
          this._emitReader(data)
          break
        case data.length === 4:
          this.emit('keypad', parseInt(data.join(''), 2))
          break
        default:
          break
      }
    })
  }

  /**
   *
   * @param {Array} data
   *
   * @emits reader
   */
  _emitReader (data) {
    if (this._checkParity(data)) {
      let dataDec = parseInt(data.slice(1, -1).join(''), 2);
      let dataHex = _reversHex(dataDec.toString(16));
      let dataRFID = _rfid_format(dataDec);
      this.emit('reader', dataDec, dataRFID, dataHex)
    }
  }
  /**
   *
   * @param {Array} data
   * @return {Boolean} okay
   */
  _checkParity (data) {
    let okay = true
    let evenParity = data.slice(0, data.length / 2)
    let oddParity = data.slice(data.length / 2)

    let fn = (x) => x

    if (evenParity.filter(fn).length & 1) {
      okay = false
    }
    if (!(oddParity.filter(fn).length & 1)) {
      okay = false
    }
    return okay
  }
  /**
   *
   * @param {Gpio} pin
   * @param {Number} data
   *
   * @emits data
   */
  _handleBit (pin, data) {
    pin.watch((_, value) => {
      clearTimeout(this.timeout)
      this.data.push(data)
      this.timeout = setTimeout(() => {
        if (this.data.length >= 4) {
          this.emit('data', this.data.slice())
        }
        this.data = []
      }, TIMEOUT)
    })
  }
  /**
   *
   * @param {Function} callback
   *
   * @emits ready
   */
  _listenToGpio (callback) {
    this._handleBit(this.d0, 0)
    this._handleBit(this.d1, 1)
    // should be good to go
    this.emit('ready', null)
    callback && this.removeListener('error', callback)
  };
  /**
   *
   * @param {Function} callback
   *
   * @emits ready
   * @emits error
   */
  begin (callback) {
    if (typeof callback !== 'function') {
      callback = null
    }

    callback && this.once('ready', callback)
    callback && this.once('callback', callback)

    // sync methods below because it's eaiser to deal with at startup
    process.nextTick(this._listenToGpio.bind(this))
  }
  /**
   *
   * @param {Function} callback
   *
   * @emits stop
   */
  stop (callback) {
    this.d0.unwatchAll()
    this.d1.unwatchAll()
    this.d0.unexport()
    this.d1.unexport()
    callback && this.once('stop', callback)
    this.emit('stop')
  }
}

module.exports = Wiegand
