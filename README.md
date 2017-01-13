# WebGL Recorder

This is a small script that lets you record the WebGL calls of any app for playback later.
Example use case: create an easily reproducible test case of a complex WebGL app that demonstrates a browser bug.

## Demo

1. Clone this repo
2. Open [demo/app.html](https://evanw.github.io/webgl-recorder/demo/app.html) in your browser
3. Wait until you want to stop recording, then click "Download Trace" (recording starts immediately)
4. Move the saved "trace.js" file next to [demo/playback.html](https://evanw.github.io/webgl-recorder/demo/playback.html) on your local machine
5. Open [demo/playback.html](https://evanw.github.io/webgl-recorder/demo/playback.html) in your browser to view the playback

## Usage

Add `<script src="webgl-recorder.js"></script>` to the page containing the WebGL code you want to record.
All WebGL contexts will begin recording immediately.
If `gl` is the `WebGLRenderingContext`, the current trace is accessible off of `gl.trace`.
The trace can be compiled to JavaScript playback code and then downloaded to a file using `gl.downloadTrace()`, or just compiled to a string without downloading using `gl.compileTrace()`.

## License

This code is licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
