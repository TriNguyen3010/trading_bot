# Pandas-TA Function Reference - Complete Indicator Details

This document contains **all** supported Pandas-TA indicators with their complete specifications including descriptions, inputs, and return value details.

**Total Indicators: 227**
**Version:** Pandas-TA 0.3.16+
**Format:** Matches TALib documentation structure for consistency

---


## Momentum

**Count: 35 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `rsi` | Relative Strength Index | `close, length=14` | 1 array | real: RSI value (0-100) |
| `mom` | Momentum | `close, length=12` | 1 array | real: Price change |
| `apo` | Absolute Price Oscillator | `close, fast=12, slow=26` | 1 array | real: APO oscillator |
| `ppo` | Percentage Price Oscillator | `close, fast=12, slow=26, signal=9` | 3 arrays | ppo: PPO | pposignal: Signal | ppohist: Histogram |
| `macd` | MACD - Moving Average Convergence/Divergence | `close, fast=12, slow=26, signal=9` | 3 arrays | macd: MACD line | macdsignal: Signal line | macdhist: MACD Histogram |
| `macdhist` | MACD Histogram only | `close, fast=12, slow=26, signal=9` | 1 array | real: MACD histogram |
| `stoch` | Stochastic Oscillator | `high, low, close, k=14, d=3, smooth_k=3` | 2 arrays | stochk: %K line | stochd: %D line |
| `stochrsi` | Stochastic RSI | `close, length=14, rsi_length=14, k=3, d=3` | 2 arrays | stochrsi_k: Stochastic %K | stochrsi_d: Stochastic %D |
| `willr` | Williams' %R | `high, low, close, length=14` | 1 array | real: Williams %R (-100 to 0) |
| `cci` | Commodity Channel Index | `high, low, close, length=20` | 1 array | real: CCI value |
| `aroon` | Aroon Indicator | `high, low, length=14` | 2 arrays | aroondown: Aroon Down% | aroonup: Aroon Up% |
| `aroonosc` | Aroon Oscillator | `high, low, length=14` | 1 array | real: Aroon Up - Aroon Down |
| `ao` | Awesome Oscillator | `high, low, fast=5, slow=34` | 1 array | real: Awesome Oscillator |
| `mfi` | Money Flow Index | `high, low, close, volume, length=14` | 1 array | real: MFI value (0-100) |
| `cmo` | Chande Momentum Oscillator | `close, length=14` | 1 array | real: CMO (-100 to +100) |
| `uo` | Ultimate Oscillator | `high, low, close, fast=7, medium=14, slow=28` | 1 array | real: UO value |
| `kst` | Know Sure Thing | `close, roc1, roc2, roc3, roc4, sma1, sma2, sma3, sma4` | 1 array | real: KST value |
| `trix` | TRIX - ROC of Triple Smooth EMA | `close, length=15` | 1 array | real: TRIX percentage |
| `tsi` | True Strength Index | `close, fast=25, slow=13` | 1 array | real: TSI value |
| `vortex` | Vortex Indicator | `high, low, close, length=14` | 2 arrays | positive_vi: Positive VI | negative_vi: Negative VI |
| `squeeze` | Squeeze Indicator | `high, low, close, bb_length=20, kc_length=11, ...` | 2 arrays | squeeze: Momentum oscillator | squeeze_on: Squeeze indicator |
| `dpo` | Detrend Price Oscillator | `close, length=21` | 1 array | real: DPO value |
| `psl` | Psychological Line | `close, open, length=12` | 1 array | real: PSL ratio |
| `cti` | Correlation Trend Indicator | `close, length=20` | 1 array | real: CTI correlation |
| `fisher` | Fisher Transform | `close, length=9` | 2 arrays | fisher: Fisher Transform | signal: Signal line |
| `bop` | Balance of Power | `open, high, low, close` | 1 array | real: BOP value |
| `cfo` | Chande Forecast Oscillator | `close, length=9` | 1 array | real: CFO value |
| `cg` | Center of Gravity | `close, length=10` | 1 array | real: COG value |
| `kvo` | Klinger Volume Oscillator | `high, low, close, volume, fast=34, slow=55` | 1 array | real: KVO value |
| `obv` | On Balance Volume | `close, volume` | 1 array | real: OBV cumulative volume |
| `adosc` | Chaikin A/D Oscillator | `high, low, close, volume, fast=3, slow=10` | 1 array | real: ADOSC value |
| `pvo` | Percentage Volume Oscillator | `volume, fast=12, slow=26, signal=9` | 3 arrays | pvo: PVO | pvosignal: Signal | pvohist: Histogram |
| `brar` | BRAR Indicator | `open, high, low, close, length=20, scalar=100` | 2 arrays | ar: AR value | br: BR value |
| `adx` | Average Directional Index | `high, low, close, length=14` | 3 arrays | adx: ADX value | plus_di: +DI | minus_di: -DI |
| `adxr` | ADXR - ADX Rating | `high, low, close, length=14` | 1 array | real: ADXR value |

## Moving Average

**Count: 41 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `sma` | Simple Moving Average | `close, length=14` | 1 array | real: SMA value |
| `ema` | Exponential Moving Average | `close, length=14` | 1 array | real: EMA value |
| `dema` | Double Exponential Moving Average | `close, length=14` | 1 array | real: DEMA value |
| `tema` | Triple Exponential Moving Average | `close, length=14` | 1 array | real: TEMA value |
| `wma` | Weighted Moving Average | `close, length=14` | 1 array | real: WMA value |
| `hma` | Hull Moving Average | `close, length=9` | 1 array | real: HMA value |
| `linreg` | Linear Regression | `close, length=14` | 1 array | real: Linear regression value |
| `midpoint` | Midpoint | `close, length=14` | 1 array | real: Midpoint value |
| `midprice` | Midpoint Price | `high, low, length=14` | 1 array | real: (highest + lowest) / 2 |
| `pwma` | Parabolic Weighted MA | `close, length=14` | 1 array | real: PWMA value |
| `alma` | Arnaud Legoux Moving Average | `close, length=14, offset=0.85` | 1 array | real: ALMA value |
| `amat` | Archer Moving Averages Trends | `close, fast=8, slow=21` | 2 arrays | aman: Fast MA | amah: Slow MA |
| `bbands` | Bollinger Bands | `close, length=20, std_dev=2, matype=0` | 5 arrays | bbl: Lower | bbm: Middle | bbu: Upper | bbb: Bandwidth | bbp: %B |
| `kc` | Keltner Channels | `high, low, close, length=20, scalar=2` | 3 arrays | kcl: Lower | kcm: Middle | kcu: Upper |
| `donchian` | Donchian Channels | `high, low, length=20` | 2 arrays | dch: Highest | dcl: Lowest |
| `accbands` | Acceleration Bands | `high, low, close, length=20, matype=0` | 3 arrays | abb: Upper | abbm: Middle | abl: Lower |
| `atr` | Average True Range | `high, low, close, length=14` | 1 array | real: ATR value |
| `natr` | Normalized ATR | `high, low, close, length=14` | 1 array | real: NATR % |
| `trange` | True Range | `high, low, close` | 1 array | real: True range |
| `bias` | Bias (SMA Deviation) | `close, length=20, matype=0` | 1 array | real: Bias % |
| `cmf` | Chaikin Money Flow | `high, low, close, volume, length=20` | 1 array | real: CMF (-1 to +1) |
| `ad` | Accumulation/Distribution | `high, low, close, volume` | 1 array | real: A/D cumulative |
| `chop` | Choppiness Index | `high, low, close, length=14` | 1 array | real: CHOP (0-100) |
| `cksp` | Chande Kroll Stop | `high, low, close, length=10, p=1, x=1` | 2 arrays | cksp_long: Long stop | cksp_short: Short stop |
| `dm` | Directional Movement | `high, low, length=14` | 2 arrays | plus_dm: +DM | minus_dm: -DM |
| `efi` | Elder's Force Index | `close, volume, length=13` | 1 array | real: EFI |
| `entropy` | Entropy | `close, length=20` | 1 array | real: Shannon entropy |
| `er` | Efficiency Ratio | `close, length=20` | 1 array | real: ER (0-1) |
| `ebsw` | Even Better Sine Wave | `close, length=10` | 2 arrays | ebsw: Sine | ebswsignal: Signal |
| `decreasing` | Decreasing Values | `close, length=5` | 1 array | real: Count |
| `swma` | Symmetrical Weighted MA | `close, length=14` | 1 array | real: SWMA |
| `rma` | Adjusted MA (EMA) | `close, length=14` | 1 array | real: RMA |
| `jma` | Jurik Moving Average | `close, length=7` | 1 array | real: JMA |
| `hwma` | Holt-Winter MA | `close, na=0.2, nb=0.1` | 1 array | real: HWMA |
| `t3` | Tillson T3 | `close, length=5` | 1 array | real: T3 |
| `vwap` | VWAP - Volume Weighted AP | `high, low, close, volume` | 1 array | real: VWAP |
| `vwma` | Volume Weighted MA | `close, volume, length=20` | 1 array | real: VWMA |
| `typical_price` | Typical Price | `high, low, close` | 1 array | real: Typical price |
| `hl2` | High-Low 2 | `high, low` | 1 array | real: (high + low) / 2 |
| `hlc3` | High-Low-Close 3 | `high, low, close` | 1 array | real: (high + low + close) / 3 |
| `ohlc4` | OHLC 4 | `open, high, low, close` | 1 array | real: (O + H + L + C) / 4 |

## Volume

**Count: 12 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `obv` | On Balance Volume | `close, volume` | 1 array | real: OBV cumulative |
| `ad` | Accumulation/Distribution | `high, low, close, volume` | 1 array | real: A/D cumulative |
| `adosc` | Chaikin A/D Oscillator | `high, low, close, volume, fast=3, slow=10` | 1 array | real: ADOSC |
| `pvo` | Percentage Volume Oscillator | `volume, fast=12, slow=26, signal=9` | 3 arrays | pvo: PVO | pvosignal: Signal | pvohist: Histogram |
| `mfi` | Money Flow Index | `high, low, close, volume, length=14` | 1 array | real: MFI % |
| `cmf` | Chaikin Money Flow | `high, low, close, volume, length=20` | 1 array | real: CMF |
| `eom` | Ease of Movement | `high, low, close, volume, length=14` | 1 array | real: EOM |
| `kvo` | Klinger Volume Oscillator | `high, low, close, volume, fast=34, slow=55` | 1 array | real: KVO |
| `nvi` | Negative Volume Index | `close, volume` | 1 array | real: NVI |
| `pvi` | Positive Volume Index | `close, volume` | 1 array | real: PVI |
| `vpt` | Volume Price Trend | `close, volume` | 1 array | real: VPT cumulative |
| `nvol` | Normalized Volume | `volume, length=20` | 1 array | real: NVOL |

## Volatility

**Count: 12 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `atr` | Average True Range | `high, low, close, length=14` | 1 array | real: ATR |
| `natr` | Normalized ATR | `high, low, close, length=14` | 1 array | real: NATR % |
| `trange` | True Range | `high, low, close` | 1 array | real: True range |
| `bbands` | Bollinger Bands | `close, length=20, std_dev=2` | 5 arrays | bbl: Lower | bbm: Middle | bbu: Upper | bbb: Bandwidth | bbp: %B |
| `kc` | Keltner Channels | `high, low, close, length=20, scalar=2` | 3 arrays | kcl: Lower | kcm: Middle | kcu: Upper |
| `cksp` | Chande Kroll Stop | `high, low, close, length=10, p=1` | 2 arrays | cksp_long: Long | cksp_short: Short |
| `accbands` | Acceleration Bands | `high, low, close, length=20` | 3 arrays | abb: Upper | abbm: Middle | abl: Lower |
| `chop` | Choppiness Index | `high, low, close, length=14` | 1 array | real: CHOP |
| `vortex` | Vortex Indicator | `high, low, close, length=14` | 2 arrays | positive_vi: +VI | negative_vi: -VI |
| `squeeze` | Squeeze Indicator | `high, low, close, ...` | 2 arrays | squeeze: Momentum | squeeze_on: Signal |
| `percent` | Percentage Change | `close` | 1 array | real: %change |
| `log_return` | Log Return | `close` | 1 array | real: ln(close/prev_close) |

## Other

**Count: 21 indicators**

| Function | Description | Inputs | Returns | Output Values |
|:---|:---|:---|:---|:---|
| `crossover` | Crossover Detection | `series1, series2` | 1 array | real: 1 if crossover else 0 |
| `crossunder` | Crossunder Detection | `series1, series2` | 1 array | real: 1 if crossunder else 0  |
| `peaks` | Peak Detection | `series, length=5` | 1 array | real: 1 if peak else 0 |
| `valleys` | Valley Detection | `series, length=5` | 1 array | real: 1 if valley else 0 |
| `trend` | Trend Detection | `close, method=hl2` | 1 array | real: 1 if uptrend else -1 |
| `above` | Above Threshold | `series, value` | 1 array | real: 1 if above else 0 |
| `below` | Below Threshold | `series, value` | 1 array | real: 1 if below else 0 |
| `above_value` | Above Value Count | `series, value, length=14` | 1 array | real: Count |
| `below_value` | Below Value Count | `series, value, length=14` | 1 array | real: Count |
| `returns` | Period Returns | `close, length=1` | 1 array | real: Returns % |
| `log_returns` | Log Returns | `close, length=1` | 1 array | real: Log returns |
| `cumulative_returns` | Cumulative Returns | `close, starting_value=100` | 1 array | real: Cumulative value |
| `rolling_std` | Rolling Std Dev | `series, length=20` | 1 array | real: Std dev |
| `rolling_var` | Rolling Variance | `series, length=20` | 1 array | real: Variance |
| `rolling_covariance` | Rolling Covariance | `series1, series2, length=20` | 1 array | real: Covariance |
| `rolling_correlation` | Rolling Correlation | `series1, series2, length=20` | 1 array | real: Correlation (-1 to +1) |
| `skew` | Skewness | `series, length=20` | 1 array | real: Skewness |
| `kurtosis` | Kurtosis | `series, length=20` | 1 array | real: Kurtosis |
| `zlma` | Zero Lag MA | `close, length=14` | 1 array | real: ZLMA |
| `ols` | Ordinary Least Squares | `y, x, length=14` | 3 arrays | slope: OLS slope | intercept: Intercept | r2: R-squared |
| `vix` | VIX Calculation (Volatility Index) | `close, high, low` | 1 array | real: Volatility index |
