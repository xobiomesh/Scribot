import numpy as np
import scipy.io.wavfile as wavfile
import simpleaudio as sa

def read_pcm(file_path, sample_rate=44100, num_channels=1, bit_depth=16):
    with open(file_path, 'rb') as pcm_file:
        byte_data = pcm_file.read()

    if bit_depth == 16:
        dtype = np.int16
    elif bit_depth == 32:
        dtype = np.int32
    else:
        raise ValueError("Unsupported bit depth")

    audio_data = np.frombuffer(byte_data, dtype=dtype)

    if num_channels > 1:
        audio_data = np.reshape(audio_data, (-1, num_channels))

    return audio_data, sample_rate

# Read the .pcm file
file_path = 'channel_messages\Télétubies\onsimius-2024-05-28T03-08-49-649Z.pcm'
audio_data, sample_rate = read_pcm(file_path)

# Save as .wav file
wav_file_path = 'output.wav'
wavfile.write(wav_file_path, sample_rate, audio_data)

# Play the .wav file
wave_obj = sa.WaveObject.from_wave_file(wav_file_path)
play_obj = wave_obj.play()
play_obj.wait_done()
