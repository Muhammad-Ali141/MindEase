# Audio Quality Improvement Guide

This guide explains how to improve TTS audio quality and what parameters you can adjust.

## Current Audio Processing

The TTS service applies several audio enhancement techniques:

1. **High-pass filtering (60 Hz)**: Removes low-frequency rumble and noise
2. **Low-pass filtering (8000 Hz)**: Removes high-frequency artifacts
3. **Spectral smoothing**: Reduces harsh frequencies for natural sound
4. **RMS normalization**: More natural volume control than peak normalization
5. **Soft clipping**: Prevents harsh distortion
6. **DC offset removal**: Centers audio around zero

## Parameters You Can Adjust

### 1. Filter Cutoff Frequencies

**Location**: `backend/tts/tts_service.py` → `_post_process_audio()` method

**High-pass filter (removes low-frequency noise)**:
```python
low_cutoff = 60.0 / nyquist  # Current: 60 Hz
```
- **Lower values (40-50 Hz)**: More bass, but may include more noise
- **Higher values (80-100 Hz)**: Cleaner speech, but may sound thinner
- **Recommended for speech**: 60-80 Hz

**Low-pass filter (removes high-frequency noise)**:
```python
high_cutoff = 8000.0 / nyquist  # Current: 8000 Hz
```
- **Lower values (6000-7000 Hz)**: Warmer sound, less artifacts
- **Higher values (10000-12000 Hz)**: More detail, but may include noise
- **Recommended for speech**: 7000-9000 Hz

### 2. Normalization Settings

**Location**: `backend/tts/tts_service.py` → `_post_process_audio()` method

**Target RMS (volume level)**:
```python
target_rms = 0.3  # Current: 0.3
```
- **Lower values (0.2-0.25)**: Quieter, more headroom
- **Higher values (0.35-0.4)**: Louder, but risk of clipping
- **Recommended**: 0.25-0.35

**Maximum gain**:
```python
gain = min(gain, 2.0)  # Current: 2.0x max amplification
```
- **Lower values (1.5)**: Safer, less amplification
- **Higher values (3.0)**: More amplification, but may introduce noise
- **Recommended**: 1.5-2.5

### 3. Smoothing Amount

**Location**: `backend/tts/tts_service.py` → `_post_process_audio()` method

**Spectral smoothing blend**:
```python
audio = 0.9 * audio + 0.1 * smoothed  # Current: 10% smoothing
```
- **Less smoothing (0.95-0.98)**: More detail, but may be harsher
- **More smoothing (0.85-0.9)**: Smoother, but may lose some clarity
- **Recommended**: 0.9-0.95

### 4. XTTS Synthesis Parameters

**Location**: `backend/tts/tts_service.py` → `synthesize()` method

**Speed parameter**:
```python
speed=1.0  # Current: normal speed
```
- **Slower (0.8-0.9)**: More clear, easier to understand
- **Faster (1.1-1.2)**: More natural pace, but may be harder to follow
- **Recommended for therapy**: 0.9-1.0 (slightly slower for clarity)

**Note**: XTTS v2 API may have additional parameters. Check Coqui TTS documentation for:
- `temperature`: Controls randomness (lower = more deterministic)
- `length_penalty`: Controls length of output
- `repetition_penalty`: Reduces repetition

### 5. Reference Audio Quality

**Location**: `backend/tts/Audios/Audio1.wav`

**Important**: The reference audio quality directly affects output quality!

**Requirements for best results**:
- **Duration**: 3-10 seconds (optimal: 5-7 seconds)
- **Format**: WAV, 16-bit or 24-bit, mono or stereo
- **Sample rate**: 22050 Hz or higher (44100 Hz recommended)
- **Quality**: 
  - Clear, noise-free recording
  - Professional microphone preferred
  - Quiet environment
  - Natural, calm speaking voice
  - No background music or noise
  - Consistent volume level

**Tips for recording reference audio**:
1. Use a good quality microphone
2. Record in a quiet room
3. Speak clearly and naturally
4. Use a calm, professional tone
5. Avoid background noise
6. Normalize the audio before using

### 6. Sample Rate

**Location**: Generated audio sample rate (XTTS default: 22050 or 24000 Hz)

**Higher sample rates** (44100 Hz, 48000 Hz):
- Better quality
- Larger file sizes
- May require resampling

**Current**: Uses XTTS default (typically 22050-24000 Hz)

## Quick Quality Improvements

### For Maximum Clarity (Recommended for Therapy):

1. **Adjust filters** in `_post_process_audio()`:
   ```python
   low_cutoff = 70.0 / nyquist  # Slightly higher (70 Hz)
   high_cutoff = 7500.0 / nyquist  # Slightly lower (7500 Hz)
   ```

2. **Reduce smoothing**:
   ```python
   audio = 0.95 * audio + 0.05 * smoothed  # Less smoothing
   ```

3. **Lower target RMS**:
   ```python
   target_rms = 0.25  # Quieter, more headroom
   ```

4. **Use slower speed**:
   ```python
   speed=0.9  # Slightly slower for clarity
   ```

### For Natural Sound:

1. **Keep current filter settings** (60 Hz, 8000 Hz)
2. **Increase smoothing slightly**:
   ```python
   audio = 0.88 * audio + 0.12 * smoothed
   ```
3. **Use normal speed**:
   ```python
   speed=1.0
   ```

## Testing Different Settings

1. Make changes to `_post_process_audio()` method
2. Test with:
   ```bash
   python backend/tts/tts_live.py --text "Hello, this is a test of audio quality" --play
   ```
3. Compare results and adjust as needed
4. Save the audio file to compare:
   ```bash
   python backend/tts/tts_live.py --text "Your test text" --output test.wav
   ```

## Common Issues and Solutions

### Issue: Audio sounds muffled
**Solution**: 
- Increase high-pass cutoff (80-100 Hz)
- Decrease low-pass cutoff (7000 Hz)
- Reduce smoothing amount

### Issue: Audio sounds harsh or robotic
**Solution**:
- Increase smoothing (0.12-0.15 blend)
- Lower high-pass cutoff (50-60 Hz)
- Increase low-pass cutoff (9000-10000 Hz)

### Issue: Audio is too quiet
**Solution**:
- Increase target_rms (0.35-0.4)
- Increase max gain (2.5-3.0)

### Issue: Audio has background noise
**Solution**:
- Improve reference audio quality
- Increase high-pass cutoff (80-100 Hz)
- Check reference audio for noise

### Issue: Audio clips or distorts
**Solution**:
- Lower target_rms (0.2-0.25)
- Reduce max gain (1.5)
- Check reference audio levels

## Reference Audio Best Practices

1. **Record in professional environment**:
   - Quiet room with minimal echo
   - Good microphone (USB condenser mic recommended)
   - Pop filter to reduce plosives

2. **Speaking style**:
   - Calm, professional tone
   - Clear pronunciation
   - Natural pace (not too fast or slow)
   - Consistent volume

3. **Audio processing before use**:
   - Normalize to -3 dB peak
   - Remove any background noise
   - Ensure mono or stereo consistency
   - Use 16-bit or 24-bit WAV format

4. **Test the reference**:
   - Listen to it first
   - Ensure it's clear and noise-free
   - Check that it represents the voice you want

## Advanced: Custom Audio Processing

You can add additional processing in `_post_process_audio()`:

- **Noise reduction**: Use libraries like `noisereduce`
- **EQ adjustments**: Boost/cut specific frequencies
- **Compression**: Even out volume levels
- **De-essing**: Reduce harsh "s" sounds

Example with noise reduction:
```python
try:
    import noisereduce as nr
    # Reduce noise (requires clean noise sample or auto-detect)
    audio = nr.reduce_noise(y=audio, sr=sample_rate)
except ImportError:
    pass
```

## Summary

**For therapy/mental health applications, prioritize**:
1. ✅ Clear, understandable speech
2. ✅ Calm, professional tone
3. ✅ Minimal background noise
4. ✅ Consistent quality
5. ✅ Natural pacing (slightly slower)

**Key parameters to adjust**:
- Filter cutoffs (60-80 Hz high-pass, 7000-9000 Hz low-pass)
- Smoothing amount (0.05-0.15)
- Target RMS (0.25-0.35)
- Speed (0.9-1.0)

**Most important**: Use a high-quality, noise-free reference audio file!

