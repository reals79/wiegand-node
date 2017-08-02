"use strict";

var Gpio = require('onoff').Gpio;
var _lastWiegand = 0,
    _cardTempHigh = 0,
    _cardTemp = 0,
    _code = 0,
    _wiegandType = 0,
    _bitCount = 0,
    d0, d1;

function Wiegand(pinD0, pinD1)
{
    _lastWiegand = 0,
    _cardTempHigh = 0,
    _cardTemp = 0,
    _code = 0,
    _wiegandType = 0,
    _bitCount = 0;

    d0 = new Gpio(pinD0, 'in', 'falling'),
    d1 = new Gpio(pinD1, 'in', 'falling'),

    interrupts();
}

function noInterrupts()
{
    d0.unwatch();
    d1.unwatch();
}

function interrupts()
{
    d0.watch(function (err, value) {
      if (err) {
        //throw err;
      }
      ReadD0();
    });

    d1.watch(function (err, value) {
      if (err) {
        //throw err;
      }
      ReadD1();
    });
}

function millis()
{
    return new Date().getTime();
}

function ReadD0()
{
    _bitCount++;                // Increament bit count for Interrupt connected to D0
    if (_bitCount>31)           // If bit count more than 31, process high bits
    {
        _cardTempHigh |= ((0x80000000 & _cardTemp)>>31);    //  shift value to high bits
        _cardTempHigh <<= 1;
        _cardTemp <<= 1;
    }
    else
    {
        _cardTemp <<= 1;        // D0 represent binary 0, so just left shift card data
    }
    _lastWiegand = millis();    // Keep track of last wiegand bit received
}

function ReadD1()
{
    _bitCount ++;               // Increment bit count for Interrupt connected to D1
    if (_bitCount>31)           // If bit count more than 31, process high bits
    {
        _cardTempHigh |= ((0x80000000 & _cardTemp)>>31);    // shift value to high bits
        _cardTempHigh <<= 1;
        _cardTemp |= 1;
        _cardTemp <<=1;
    }
    else
    {
        _cardTemp |= 1;         // D1 represent binary 1, so OR card data with 1 then
        _cardTemp <<= 1;        // left shift card data
    }
    _lastWiegand = millis();    // Keep track of last wiegand bit received
}

function GetCardId(codehigh, codelow, bitlength)
{
    if (bitlength == 26)                              // EM tag
        return (codelow & 0x1FFFFFE) >> 1;

    if (bitlength == 34)                              // Mifare 
    {
        codehigh = codehigh & 0x03;               // only need the 2 LSB of the codehigh
        codehigh <<= 30;                           // shift 2 LSB to MSB       
        codelow >>= 1;
        return codehigh | codelow;
    }
    return codelow;                                // EM tag or Mifare without parity bits
}

function translateEnterEscapeKeyPress(originalKeyPress) {
    switch(originalKeyPress) {
        case 0x0b:        // 11 or * key
            return 0x0d;  // 13 or ASCII ENTER

        case 0x0a:        // 10 or # key
            return 0x1b;  // 27 or ASCII ESCAPE

        default:
            return originalKeyPress;
    }
}

function DoWiegandConversion()
{
    var cardID;
    var sysTick = millis();
    
    if ((sysTick - _lastWiegand) > 25)                              // if no more signal coming through after 25ms
    {
        if ((_bitCount == 24) || (_bitCount == 26) || (_bitCount == 32) || (_bitCount == 34) || (_bitCount == 8) || (_bitCount == 4))   // bitCount for keypress=4 or 8, Wiegand 26=24 or 26, Wiegand 34=32 or 34
        {
            _cardTemp >>= 1;            // shift right 1 bit to get back the real value - interrupt done 1 left shift in advance
            if (_bitCount > 32)           // bit count more than 32 bits, shift high bits right to make adjustment
                _cardTempHigh >>= 1;    

            if (_bitCount == 8)       // keypress wiegand with integrity
            {
                // 8-bit Wiegand keyboard data, high nibble is the "NOT" of low nibble
                // eg if key 1 pressed, data=E1 in binary 11100001 , high nibble=1110 , low nibble = 0001 
                highNibble = (_cardTemp & 0xf0) >> 4;
                lowNibble = (_cardTemp & 0x0f);
                _wiegandType = _bitCount;                 
                _bitCount = 0;
                _cardTemp = 0;
                _cardTempHigh = 0;
                
                if (lowNibble == (~highNibble & 0x0f))      // check if low nibble matches the "NOT" of high nibble.
                {
                    _code = translateEnterEscapeKeyPress(lowNibble);
                    return true;
                }

                // TODO: Handle validation failure case!
            }
            else if (4 == _bitCount) {
                // 4-bit Wiegand codes have no data integrity check so we just
                // read the LOW nibble.
                _code = translateEnterEscapeKeyPress(_cardTemp & 0x0000000F);

                _wiegandType = _bitCount;
                _bitCount = 0;
                _cardTemp = 0;
                _cardTempHigh = 0;

                return true;
            }
            else        // wiegand 26 or wiegand 34
            {
                cardID = GetCardId(_cardTempHigh, _cardTemp, _bitCount);
                _wiegandType = _bitCount;
                _bitCount = 0;
                _cardTemp = 0;
                _cardTempHigh = 0;
                _code = cardID;
                return true;
            }
        }
        else
        {
            // well time over 25 ms and bitCount !=8 , !=26, !=34 , must be noise or nothing then.
            _lastWiegand = sysTick;
            _bitCount = 0;            
            _cardTemp = 0;
            _cardTempHigh = 0;
            return false;
        }   
    }
    else
        return false;
}

function rfid_formatter(value)
{
    var str_value = value.toString();
    while (str_value.length < 10)
        str_value = "0" + str_value;
    return str_value;
}

Wiegand.prototype.available = function()
{
    noInterrupts();
    var ret = DoWiegandConversion();
    interrupts();
    return ret;
}

Wiegand.prototype.getCode = function()
{
    return rfid_formatter(_code);
}

module.exports = Wiegand;
