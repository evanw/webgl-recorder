(function() {
  var getContext = HTMLCanvasElement.prototype.getContext;
  var requestAnimationFrame = window.requestAnimationFrame;
  var frameSincePageLoad = 0;

  function countFrames() {
    frameSincePageLoad++;
    requestAnimationFrame(countFrames);
  }

  window.requestAnimationFrame = function() {
    return requestAnimationFrame.apply(window, arguments);
  };

  HTMLCanvasElement.prototype.getContext = function(type) {
    const canvas = this;
    const context = getContext.apply(canvas, arguments);

    if (type === 'webgl' || type === 'experimental-webgl') {
      let oldWidth = canvas.width;
      let oldHeight = canvas.height;
      let oldFrameCount = frameSincePageLoad;
      const trace = [];
      const variables = {};

      trace.push('  gl.canvas.width = ' + oldWidth + ';');
      trace.push('  gl.canvas.height = ' + oldHeight + ';');

      function compileTrace() {
        let text = 'function* render(gl) {\n';
        text += '  // Recorded using https://github.com/evanw/webgl-recorder\n';
        for (let key in variables) {
          text += '  const ' + key + 's = [];\n';
        }
        text += trace.join('\n');
        text += '\n}\n';
        return text;
      }

      function downloadTrace() {
        const text = compileTrace();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([text], {type: 'application/javascript'}));
        link.download = 'trace.js';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function getVariable(value) {
        if (value instanceof WebGLActiveInfo ||
            value instanceof WebGLBuffer ||
            value instanceof WebGLFramebuffer ||
            value instanceof WebGLProgram ||
            value instanceof WebGLRenderbuffer ||
            value instanceof WebGLShader ||
            value instanceof WebGLShaderPrecisionFormat ||
            value instanceof WebGLTexture ||
            value instanceof WebGLUniformLocation ||
            value instanceof WebGLVertexArrayObject ||
            // In Chrome, value won't be an instanceof WebGLVertexArrayObject.
            (value && value.constructor.name == "WebGLVertexArrayObjectOES") ||
            typeof value === 'object') {
          const name = value.constructor.name;
          const list = variables[name] || (variables[name] = []);
          let index = list.indexOf(value);

          if (index === -1) {
            index = list.length;
            list.push(value);
          }

          return name + 's[' + index + ']';
        }

        return null;
      }

      function patch(name, object) {
        const patched = {};
        for (const key in object) {
          const value = object[key];
          if (typeof value === 'function') {
            patched[key] = function () {
              const result = value.apply(object, arguments);

              if (frameSincePageLoad !== oldFrameCount) {
                oldFrameCount = frameSincePageLoad;
                trace.push('  yield;');
              }

              if (canvas.width !== oldWidth || canvas.height !== oldHeight) {
                oldWidth = canvas.width;
                oldHeight = canvas.height;
                trace.push('  gl.canvas.width = ' + oldWidth + ';');
                trace.push('  gl.canvas.height = ' + oldHeight + ';');
              }

              for (let i = 0; i < arguments.length; i++) {
                const arg = arguments[i];

                if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'string' || arg === null) {
                  args.push(JSON.stringify(arg));
                }

                else if (ArrayBuffer.isView(arg)) {
                  args.push('new ' + arg.constructor.name + '([' + Array.prototype.slice.call(arg) + '])');
                }

                else {
                  const variable = getVariable(arg);
                  if (variable !== null) {
                    args.push(variable);
                  }

                  else {
                    console.warn('unsupported value:', arg);
                    args.push('null');
                  }
                }
              }

              let text = `${name}.${key}(${args.join(', ')});`;
              const variable = getVariable(result);
              if (variable !== null) text = variable + ' = ' + text;
              trace.push('  ' + text);

              if (result === null) return null;
              if (result === undefined) return undefined;
              // In Firefox, getExtension returns things with constructor.name == 'Object', but in
              // Chrome getExtension returns unique constructor.names.
              if (result.constructor.name === 'Object' || key == 'getExtension') {
                return patch(variable, result);
              }
              return result;
            };
          } else { // typeof value !== function
            Object.defineProperty(patched, key, {
              configurable: false,
              enumerable: true,
              get() {
                return object[key];
              }
            });
          }
        }
        return patched;
      }

      const fakeContext = patch('gl', context);
      Object.assign(fakeContext, {
        trace: trace,
        compileTrace: compileTrace,
        downloadTrace: downloadTrace,
      });
      return fakeContext;
    }

    return context;
  };

  countFrames();
})();
