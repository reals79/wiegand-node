"use strict";

var Gpio = require('onoff').Gpio;

function Wiegand(pinD0, pinD1)
{
    this._lastWiegand = 0,
    this._cardTempHigh = 0,
    this._cardTemp = 0,
    this._code = 0,
    this._wiegandType = 0,
    this._bitCount = 0;

    this.d0 = new Gpio(pinD0, 'in', 'falling');
    this.d1 = new Gpio(pinD1, 'in', 'falling');

    this.interrupts();
}

function millis()
{
    return new Date().getTime();
}

Wiegand.prototype.ReadD0 = function()
{
    this._bitCount++;                // Increament bit count for Interrupt connected to D0
    if (this._bitCount>31)           // If bit count more than 31, process high bits
    {
        this._cardTempHigh |= ((0x80000000 & this._cardTemp)>>31);    //  shift value to high bits
        this._cardTempHigh <<= 1;
        this._cardTemp <<= 1;
    }
    else
    {
        this._cardTemp <<= 1;        // D0 represent binary 0, so just left shift card data
    }
    this._lastWiegand = millis();    // Keep track of last wiegand bit received
}

Wiegand.prototype.ReadD1 = function()
{
    this._bitCount ++;               // Increment bit count for Interrupt connected to D1
    if (this._bitCount>31)           // If bit count more than 31, process high bits
    {
        this._cardTempHigh |= ((0x80000000 & this._cardTemp)>>31);    // shift value to high bits
        this._cardTempHigh <<= 1;
        this._cardTemp |= 1;
        this._cardTemp <<=1;
    }
    else
    {
        this._cardTemp |= 1;         // D1 represent binary 1, so OR card data with 1 then
        this._cardTemp <<= 1;        // left shift card data
    }
    this._lastWiegand = millis();    // Keep track of last wiegand bit received
}

Wiegand.prototype.noInterrupts = function()
{
    this.d0.unwatch();
    this.d1.unwatch();
}

Wiegand.prototype.interrupts = function()
{
    var that = this;
    this.d0.watch(function (err, value) {
      if (err) {
        //throw err;
      }
      that.ReadD0();
    });

    this.d1.watch(function (err, value) {
      if (err) {
        //throw err;
      }
      that.ReadD1();
    });
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

Wiegand.prototype.DoWiegandConversion = function()
{
    var cardID;
    var sysTick = millis();
    
    if ((sysTick - this._lastWiegand) > 25)                              // if no more signal coming through after 25ms
    {
        if ((this._bitCount == 24) || (this._bitCount == 26) || (this._bitCount == 32) || (this._bitCount == 34) || (this._bitCount == 8) || (this._bitCount == 4))   // bitCount for keypress=4 or 8, Wiegand 26=24 or 26, Wiegand 34=32 or 34
        {
            this._cardTemp >>= 1;            // shift right 1 bit to get back the real value - interrupt done 1 left shift in advance
            if (this._bitCount > 32)           // bit count more than 32 bits, shift high bits right to make adjustment
                this._cardTempHigh >>= 1;    

            if (this._bitCount == 8)       // keypress wiegand with integrity
            {
                // 8-bit Wiegand keyboard data, high nibble is the "NOT" of low nibble
                // eg if key 1 pressed, data=E1 in binary 11100001 , high nibble=1110 , low nibble = 0001 
                highNibble = (this._cardTemp & 0xf0) >> 4;
                lowNibble = (this._cardTemp & 0x0f);
                this._wiegandType = this._bitCount;                 
                this._bitCount = 0;
                this._cardTemp = 0;
                this._cardTempHigh = 0;
                
                if (lowNibble == (~highNibble & 0x0f))      // check if low nibble matches the "NOT" of high nibble.
                {
                    this._code = translateEnterEscapeKeyPress(lowNibble);
                    return true;
                }

                // TODO: Handle validation failure case!
            }
            else if (4 == this._bitCount) {
                // 4-bit Wiegand codes have no data integrity check so we just
                // read the LOW nibble.
                this._code = translateEnterEscapeKeyPress(this._cardTemp & 0x0000000F);

                this._wiegandType = this._bitCount;
                this._bitCount = 0;
                this._cardTemp = 0;
                this._cardTempHigh = 0;

                return true;
            }
            else        // wiegand 26 or wiegand 34
            {
                cardID = GetCardId(this._cardTempHigh, this._cardTemp, this._bitCount);
                this._wiegandType = this._bitCount;
                this._bitCount = 0;
                this._cardTemp = 0;
                this._cardTempHigh = 0;
                this._code = cardID;
                return true;
            }
        }
        else
        {
            // well time over 25 ms and bitCount !=8 , !=26, !=34 , must be noise or nothing then.
            this._lastWiegand = sysTick;
            this._bitCount = 0;            
            this._cardTemp = 0;
            this._cardTempHigh = 0;
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
        str_value = '0' + str_value;
    return str_value;
}

Wiegand.prototype.available = function()
{
    this.noInterrupts();
    var ret = this.DoWiegandConversion();
    this.interrupts();
    return ret;
}

Wiegand.prototype.getCode = function()
{
    return rfid_formatter(this._code);
}

module.exports = Wiegand;
