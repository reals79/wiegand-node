# Wiegand 26 and Wiegand 34 module for Node.js and using on Raspberry Pi
The Wiegand interface is a de facto standard commonly used to connect a card reader or keypad to an electronic entry system. 
Wiegand interface has the ability to transmit signal over long distance with a simple 3 wires connection. 
This module uses interrupt pins from Raspberry Pi to read the pulses from Wiegand interface and return the code and type of the Wiegand.

## Installation 

	npm install wiegand-node
    
### Example
<pre><code>
"use strict";

var Wiegand = require('wiegand-node');

var pinD0 = 4,  //DATA0 of Wiegand connects to RPi GPIO04 (Pin 7)
    pinD1 = 17; //DATA1 of Wiegand connects to RPi GPIO17 (Pin 11)

var wg = new Wiegand(pinD0, pinD1);

function getCode()
{
    if (wg.available())
        console.log(wg.getCode()); //Display code
}

setInterval(getCode); //Infinite loop

</code></pre>

## Credits

Based on the [Wiegand-Protocol-Library-for-Arduino](https://github.com/monkeyboard/Wiegand-Protocol-Library-for-Arduino).
