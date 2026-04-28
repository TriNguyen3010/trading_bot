# TA-Lib Function Reference - Complete Indicator Details

This document contains **all** supported TALib indicators with their complete specifications including descriptions and return value details.

**Total Indicators: 162**

## Cycle Indicators

**Count: 5 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `HT_DCPERIOD` | Hilbert Transform - Dominant Cycle Period | ``price data`` | 1 array | `real`: Real value |
| `HT_DCPHASE` | Hilbert Transform - Dominant Cycle Phase | ``price data`` | 1 array | `real`: Real value |
| `HT_PHASOR` | Hilbert Transform - Phasor Components | ``price data`` | 2 arrays | `inphase`: In-phase component | `quadrature`: Quadrature component |
| `HT_SINE` | Hilbert Transform - SineWave | ``price data`` | 2 arrays | `sine`: Sine wave | `leadsine`: Leading sine wave |
| `HT_TRENDMODE` | Hilbert Transform - Trend vs Cycle Mode | ``price data`` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |

## Math Operators

**Count: 11 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `ADD` | Vector Arithmetic Add | ``price data`` | 1 array | `real`: Real value |
| `DIV` | Vector Arithmetic Div | ``price data`` | 1 array | `real`: Real value |
| `MAX` | Highest value over a specified period | ``price data`` | 1 array | `real`: Real value |
| `MAXINDEX` | Index of highest value over a specified period | ``price data`` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `MIN` | Lowest value over a specified period | ``price data`` | 1 array | `real`: Real value |
| `MININDEX` | Index of lowest value over a specified period | ``price data`` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `MINMAX` | Lowest and highest values over a specified period | ``price data`` | 2 arrays | `min`: Minimum value | `max`: Maximum value |
| `MINMAXINDEX` | Indexes of lowest and highest values over a specified period | ``price data`` | 2 arrays | `minidx`: Index of minimum value | `maxidx`: Index of maximum value |
| `MULT` | Vector Arithmetic Mult | ``price data`` | 1 array | `real`: Real value |
| `SUB` | Vector Arithmetic Subtraction | ``price data`` | 1 array | `real`: Real value |
| `SUM` | Summation | ``price data`` | 1 array | `real`: Real value |

## Math Transform

**Count: 15 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `ACOS` | Vector Trigonometric ACos | ``price data`` | 1 array | `real`: Real value |
| `ASIN` | Vector Trigonometric ASin | ``price data`` | 1 array | `real`: Real value |
| `ATAN` | Vector Trigonometric ATan | ``price data`` | 1 array | `real`: Real value |
| `CEIL` | Vector Ceil | ``price data`` | 1 array | `real`: Real value |
| `COS` | Vector Trigonometric Cos | ``price data`` | 1 array | `real`: Real value |
| `COSH` | Vector Trigonometric Cosh | ``price data`` | 1 array | `real`: Real value |
| `EXP` | Vector Arithmetic Exp | ``price data`` | 1 array | `real`: Real value |
| `FLOOR` | Vector Floor | ``price data`` | 1 array | `real`: Real value |
| `LN` | Vector Log Natural | ``price data`` | 1 array | `real`: Real value |
| `LOG10` | Vector Log10 | ``price data`` | 1 array | `real`: Real value |
| `SIN` | Vector Trigonometric Sin | ``price data`` | 1 array | `real`: Real value |
| `SINH` | Vector Trigonometric Sinh | ``price data`` | 1 array | `real`: Real value |
| `SQRT` | Vector Square Root | ``price data`` | 1 array | `real`: Real value |
| `TAN` | Vector Trigonometric Tan | ``price data`` | 1 array | `real`: Real value |
| `TANH` | Vector Trigonometric Tanh | ``price data`` | 1 array | `real`: Real value |

## Momentum Indicators

**Count: 31 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `ADX` | Average Directional Movement Index | `high, low, close` | 1 array | `real`: Real value |
| `ADXR` | Average Directional Movement Index Rating | `high, low, close` | 1 array | `real`: Real value |
| `APO` | Absolute Price Oscillator | ``price data`` | 1 array | `real`: Real value |
| `AROON` | Aroon | `high, low` | 2 arrays | `aroondown`: Aroon Down line (periods since 14-period high) | `aroonup`: Aroon Up line (periods since 14-period low) |
| `AROONOSC` | Aroon Oscillator | `high, low` | 1 array | `real`: Real value |
| `BOP` | Balance Of Power | `open, high, low, close` | 1 array | `real`: Real value |
| `CCI` | Commodity Channel Index | `high, low, close` | 1 array | `real`: Real value |
| `CMO` | Chande Momentum Oscillator | ``price data`` | 1 array | `real`: Real value |
| `DX` | Directional Movement Index | `high, low, close` | 1 array | `real`: Real value |
| `IMI` | Intraday Momentum Index | `open, close` | 1 array | `real`: Real value |
| `MACD` | Moving Average Convergence/Divergence | ``price data`` | 3 arrays | `macd`: MACD line | `macdsignal`: MACD signal line | `macdhist`: MACD histogram (difference between MACD and signal) |
| `MACDEXT` | MACD with controllable MA type | ``price data`` | 3 arrays | `macd`: MACD line | `macdsignal`: MACD signal line | `macdhist`: MACD histogram (difference between MACD and signal) |
| `MACDFIX` | Moving Average Convergence/Divergence Fix 12/26 | ``price data`` | 3 arrays | `macd`: MACD line | `macdsignal`: MACD signal line | `macdhist`: MACD histogram (difference between MACD and signal) |
| `MFI` | Money Flow Index | `high, low, close, volume` | 1 array | `real`: Real value |
| `MINUS_DI` | Minus Directional Indicator | `high, low, close` | 1 array | `real`: Real value |
| `MINUS_DM` | Minus Directional Movement | `high, low` | 1 array | `real`: Real value |
| `MOM` | Momentum | ``price data`` | 1 array | `real`: Real value |
| `PLUS_DI` | Plus Directional Indicator | `high, low, close` | 1 array | `real`: Real value |
| `PLUS_DM` | Plus Directional Movement | `high, low` | 1 array | `real`: Real value |
| `PPO` | Percentage Price Oscillator | ``price data`` | 1 array | `real`: Real value |
| `ROC` | Rate of change : ((real/prevPrice)-1)*100 | ``price data`` | 1 array | `real`: Real value |
| `ROCP` | Rate of change Percentage: (real-prevPrice)/prevPrice | ``price data`` | 1 array | `real`: Real value |
| `ROCR` | Rate of change ratio: (real/prevPrice) | ``price data`` | 1 array | `real`: Real value |
| `ROCR100` | Rate of change ratio 100 scale: (real/prevPrice)*100 | ``price data`` | 1 array | `real`: Real value |
| `RSI` | Relative Strength Index | ``price data`` | 1 array | `real`: Real value |
| `STOCH` | Stochastic | `high, low, close` | 2 arrays | `slowk`: Slow %K line (Stochastic) | `slowd`: Slow %D line (Stochastic signal) |
| `STOCHF` | Stochastic Fast | `high, low, close` | 2 arrays | `fastk`: Fast %K line (Stochastic) | `fastd`: Fast %D line (Stochastic signal) |
| `STOCHRSI` | Stochastic Relative Strength Index | ``price data`` | 2 arrays | `fastk`: Fast %K line (Stochastic) | `fastd`: Fast %D line (Stochastic signal) |
| `TRIX` | 1-day Rate-Of-Change (ROC) of a Triple Smooth EMA | ``price data`` | 1 array | `real`: Real value |
| `ULTOSC` | Ultimate Oscillator | `high, low, close` | 1 array | `real`: Real value |
| `WILLR` | Williams' %R | `high, low, close` | 1 array | `real`: Real value |

## Overlap Studies

**Count: 19 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `ACCBANDS` | Acceleration Bands | `high, low, close` | 3 arrays | `upperband`: Upper Bollinger Band | `middleband`: Middle Bollinger Band (SMA) | `lowerband`: Lower Bollinger Band |
| `BBANDS` | Bollinger Bands | ``price data`` | 3 arrays | `upperband`: Upper Bollinger Band | `middleband`: Middle Bollinger Band (SMA) | `lowerband`: Lower Bollinger Band |
| `DEMA` | Double Exponential Moving Average | ``price data`` | 1 array | `real`: Real value |
| `EMA` | Exponential Moving Average | ``price data`` | 1 array | `real`: Real value |
| `HT_TRENDLINE` | Hilbert Transform - Instantaneous Trendline | ``price data`` | 1 array | `real`: Real value |
| `KAMA` | Kaufman Adaptive Moving Average | ``price data`` | 1 array | `real`: Real value |
| `MA` | Moving average | ``price data`` | 1 array | `real`: Real value |
| `MAMA` | MESA Adaptive Moving Average | ``price data`` | 2 arrays | `mama`: MESA Adaptive Moving Average | `fama`: Adaptive moving average (following moving average) |
| `MAVP` | Moving average with variable period | ``price data`` | 1 array | `real`: Real value |
| `MIDPOINT` | MidPoint over period | ``price data`` | 1 array | `real`: Real value |
| `MIDPRICE` | Midpoint Price over period | `high, low` | 1 array | `real`: Real value |
| `SAR` | Parabolic SAR | `high, low` | 1 array | `real`: Real value |
| `SAREXT` | Parabolic SAR - Extended | `high, low` | 1 array | `real`: Real value |
| `SMA` | Simple Moving Average | ``price data`` | 1 array | `real`: Real value |
| `T3` | Triple Exponential Moving Average (T3) | ``price data`` | 1 array | `real`: Real value |
| `TEMA` | Triple Exponential Moving Average | ``price data`` | 1 array | `real`: Real value |
| `TRIMA` | Triangular Moving Average | ``price data`` | 1 array | `real`: Real value |
| `WMA` | Weighted Moving Average | ``price data`` | 1 array | `real`: Real value |
| `wrapped_func` | Weighted Moving Average | ``price data`` | 1 array | `real`: Real value |

## Pattern Recognition

**Count: 61 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `CDL2CROWS` | Two Crows | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDL3BLACKCROWS` | Three Black Crows | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDL3INSIDE` | Three Inside Up/Down | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDL3LINESTRIKE` | Three-Line Strike | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDL3OUTSIDE` | Three Outside Up/Down | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDL3STARSINSOUTH` | Three Stars In The South | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDL3WHITESOLDIERS` | Three Advancing White Soldiers | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLABANDONEDBABY` | Abandoned Baby | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLADVANCEBLOCK` | Advance Block | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLBELTHOLD` | Belt-hold | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLBREAKAWAY` | Breakaway | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLCLOSINGMARUBOZU` | Closing Marubozu | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLCONCEALBABYSWALL` | Concealing Baby Swallow | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLCOUNTERATTACK` | Counterattack | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLDARKCLOUDCOVER` | Dark Cloud Cover | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLDOJI` | Doji | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLDOJISTAR` | Doji Star | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLDRAGONFLYDOJI` | Dragonfly Doji | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLENGULFING` | Engulfing Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLEVENINGDOJISTAR` | Evening Doji Star | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLEVENINGSTAR` | Evening Star | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLGAPSIDESIDEWHITE` | Up/Down-gap side-by-side white lines | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLGRAVESTONEDOJI` | Gravestone Doji | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHAMMER` | Hammer | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHANGINGMAN` | Hanging Man | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHARAMI` | Harami Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHARAMICROSS` | Harami Cross Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHIGHWAVE` | High-Wave Candle | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHIKKAKE` | Hikkake Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHIKKAKEMOD` | Modified Hikkake Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLHOMINGPIGEON` | Homing Pigeon | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLIDENTICAL3CROWS` | Identical Three Crows | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLINNECK` | In-Neck Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLINVERTEDHAMMER` | Inverted Hammer | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLKICKING` | Kicking | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLKICKINGBYLENGTH` | Kicking - bull/bear determined by the longer marubozu | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLLADDERBOTTOM` | Ladder Bottom | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLLONGLEGGEDDOJI` | Long Legged Doji | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLLONGLINE` | Long Line Candle | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLMARUBOZU` | Marubozu | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLMATCHINGLOW` | Matching Low | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLMATHOLD` | Mat Hold | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLMORNINGDOJISTAR` | Morning Doji Star | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLMORNINGSTAR` | Morning Star | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLONNECK` | On-Neck Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLPIERCING` | Piercing Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLRICKSHAWMAN` | Rickshaw Man | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLRISEFALL3METHODS` | Rising/Falling Three Methods | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLSEPARATINGLINES` | Separating Lines | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLSHOOTINGSTAR` | Shooting Star | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLSHORTLINE` | Short Line Candle | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLSPINNINGTOP` | Spinning Top | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLSTALLEDPATTERN` | Stalled Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLSTICKSANDWICH` | Stick Sandwich | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLTAKURI` | Takuri (Dragonfly Doji with very long lower shadow) | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLTASUKIGAP` | Tasuki Gap | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLTHRUSTING` | Thrusting Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLTRISTAR` | Tristar Pattern | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLUNIQUE3RIVER` | Unique 3 River | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLUPSIDEGAP2CROWS` | Upside Gap Two Crows | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |
| `CDLXSIDEGAP3METHODS` | Upside/Downside Gap Three Methods | `open, high, low, close` | 1 array | `integer (values are -100, 0 or 100)`: integer (values are -100, 0 or 100) |

## Price Transform

**Count: 5 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `AVGDEV` | Average Deviation | ``price data`` | 1 array | `real`: Real value |
| `AVGPRICE` | Average Price | `open, high, low, close` | 1 array | `real`: Real value |
| `MEDPRICE` | Median Price | `high, low` | 1 array | `real`: Real value |
| `TYPPRICE` | Typical Price | `high, low, close` | 1 array | `real`: Real value |
| `WCLPRICE` | Weighted Close Price | `high, low, close` | 1 array | `real`: Real value |

## Statistic Functions

**Count: 9 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `BETA` | Beta | ``price data`` | 1 array | `real`: Real value |
| `CORREL` | Pearson's Correlation Coefficient (r) | ``price data`` | 1 array | `real`: Real value |
| `LINEARREG` | Linear Regression | ``price data`` | 1 array | `real`: Real value |
| `LINEARREG_ANGLE` | Linear Regression Angle | ``price data`` | 1 array | `real`: Real value |
| `LINEARREG_INTERCEPT` | Linear Regression Intercept | ``price data`` | 1 array | `real`: Real value |
| `LINEARREG_SLOPE` | Linear Regression Slope | ``price data`` | 1 array | `real`: Real value |
| `STDDEV` | Standard Deviation | ``price data`` | 1 array | `real`: Real value |
| `TSF` | Time Series Forecast | ``price data`` | 1 array | `real`: Real value |
| `VAR` | Variance | ``price data`` | 1 array | `real`: Real value |

## Volatility Indicators

**Count: 3 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `ATR` | Average True Range | `high, low, close` | 1 array | `real`: Real value |
| `NATR` | Normalized Average True Range | `high, low, close` | 1 array | `real`: Real value |
| `TRANGE` | True Range | `high, low, close` | 1 array | `real`: Real value |

## Volume Indicators

**Count: 3 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `AD` | Chaikin A/D Line | `high, low, close, volume` | 1 array | `real`: Real value |
| `ADOSC` | Chaikin A/D Oscillator | `high, low, close, volume` | 1 array | `real`: Real value |
| `OBV` | On Balance Volume | ``price data`` | 1 array | `real`: Real value |
