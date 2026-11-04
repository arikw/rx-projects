# Model files

Model files for download, attached to the release [`models-1`](../../releases/tag/models-1).

**None of these models is ours.** Each one is the work of its authors, listed below, and is shared here unchanged or
converted, under its own license. Nothing here grants any rights beyond those licenses. Each zip holds an
`ATTRIBUTION.txt` with its source, its license and what was changed.

| File | Size (bytes) | SHA-256 |
|---|---|---|
| `melllm-zipformer2-66m-he-1.zip` | 72,318,241 | `596f6cdcfebb12d9e45052da1af787ac7f5d69c4077f8d4a649f6810a980cd5a` |
| `melllm-zipformer2-en-1.zip` | 72,655,943 | `d92e807b78aefb66272f1fb9c7be45aab054e476efc10c0dd20f404b47f4aeb0` |
| `melllm-speakers-1.zip` | 46,252,456 | `774cdbfbc7f897b01a7b6f9f862aba7cacf98069f9885c13f69b91ecba426fb6` |
| `melllm-whisper-turbo-q5k-he-1.zip` | 574,686,206 | `3cf11826751d1344a11781ac488114ad0ef757049961c30727002e34e3e231b3` |
| `melllm-punct-he-1.zip` | 90,990,597 | `a3807b85463b543ce97a081e0103bd308a77d115be5d3998e60a350444f70afd` |

## Sources and licenses

- `melllm-zipformer2-66m-he-1.zip`: [ivrit-ai/zipformer2-66m-streaming-he](https://huggingface.co/ivrit-ai/zipformer2-66m-streaming-he),
  by Yakov Kolani ([original](https://huggingface.co/thewh1teagle/zipformer2-66m-streaming-he)), via ivrit.ai.
  [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/). Files unchanged.
- `melllm-zipformer2-en-1.zip`: [csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-2023-06-26),
  by the k2-fsa project. [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0). Files renamed only.
- `melllm-speakers-1.zip`:
  - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0), © 2022 CNRS, MIT, in the
    [ONNX export by k2-fsa](https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0);
  - NVIDIA NeMo [TitaNet-small](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/models/titanet_small),
    Apache-2.0 (the NeMo Toolkit's license), in the
    [ONNX export by k2-fsa](https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models).
  - Files renamed only.
- `melllm-whisper-turbo-q5k-he-1.zip`:
  - [ivrit-ai/whisper-large-v3-turbo-ggml](https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ggml), by ivrit.ai
    (fine-tuned from OpenAI's Whisper large-v3 turbo), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0).
    Quantized to 5 bits (q5_k) with whisper.cpp.
  - [Silero VAD](https://github.com/snakers4/silero-vad), © Silero Team, MIT, as published by k2-fsa. Unchanged.
- `melllm-punct-he-1.zip`: [Horizon-Labs/punctuation-restoration-small](https://huggingface.co/Horizon-Labs/punctuation-restoration-small),
  [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0). Its token table cut to what Hebrew text uses, weights
  stored in 16 bits, and a smaller tokenizer file.

All files are provided as they are, without warranties of any kind.
