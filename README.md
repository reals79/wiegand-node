# Wiegand 26 and Wiegand 34 module for Node.js and using on Raspberry Pi
The Wiegand interface is a de facto standard commonly used to connect a card reader or keypad to an electronic entry system. 
Wiegand interface has the ability to transmit signal over long distance with a simple 3 wires connection. 
This module uses interrupt pins from Raspberry Pi to read the pulses from Wiegand interface and return the code and type of the Wiegand.

## Installation 

	npm install wiegand-node
    
### Example
<pre><code>
"use strict";

const Wiegand = require('wiegand-node');

var pinD0 = 4,  //DATA0 of Wiegand connects to RPi GPIO04 (Pin 7)
    pinD1 = 17; //DATA1 of Wiegand connects to RPi GPIO17 (Pin 11)

const w = new Wiegand({ d0: pinD0, d1: pinD1 });
w.begin();
w.on('reader', (idDec, idRFID, idHex) => {
  console.log(idDec); // RAW data
  
  console.log(idRFID); // EM format
  
  console.log(idHex); // Mifare format
});
</code></pre>

#### Settings
<pre><code>
const w = new Wiegand(
    { 
        d0: int, // the number of your GPIO PIN. This means eg. "4" for "GPIO04", not 7 from "Pin 7" | default 4
        d1: int  // the number of your GPIO PIN. This means eg. "17" for "GPIO17", not 11 from "Pin 11" | default 11
        debug: bool // enable debug console output | default false 
    }
);
</code></pre>

#### Available Watchers
<pre><code>
w.on('reader', (idDec, idRFID, idHex) => {
    // stuff
});
w.on('reader_failed_parity', (data) => {
    // stuff
});
</code></pre>

## Contributors
[Reals](https://github.com/reals79)\
[Elompenta](https://github.com/Elompenta)
