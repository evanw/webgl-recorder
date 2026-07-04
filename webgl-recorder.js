(function () {
  var contexts = new WeakMap();
  var getContext = HTMLCanvasElement.prototype.getContext;
  var requestAnimationFrame = window.requestAnimationFrame;
  var frameSincePageLoad = 0;

  function countFrames() {
    frameSincePageLoad++;
    requestAnimationFrame(countFrames);
  }

  window.requestAnimationFrame = function () {
    return requestAnimationFrame.apply(window, arguments);
  };

  HTMLCanvasElement.prototype.getContext = function (type) {
    const canvas = this;
    const context = getContext.apply(canvas, arguments);

    if (
      type === "webgl" ||
      type === "experimental-webgl" ||
      type === "webgl2"
    ) {
      if (!context) return null;
      if (contexts.has(context)) return contexts.get(context);

      let oldWidth = canvas.width;
      let oldHeight = canvas.height;
      let oldFrameCount = frameSincePageLoad;
      const trace = [];
      const variables = {};

      trace.push("  gl.canvas.width = " + oldWidth + ";");
      trace.push("  gl.canvas.height = " + oldHeight + ";");

      function compileTrace() {
        let text = "function* render(gl) {\n";
        text += "  // Recorded using https://github.com/evanw/webgl-recorder\n";
        for (let key in variables) {
          text += "  const " + key + "s = [];\n";
        }
        text += trace.join("\n");
        text += "\n}\n";
        return text;
      }

      function downloadTrace() {
        const text = compileTrace();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(
          new Blob([text], {
            type: "application/javascript",
          }),
        );
        link.download = "trace.js";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      function getVariable(value) {
        if (
          value instanceof WebGLActiveInfo ||
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
          typeof value === "object"
        ) {
          const name = value.constructor.name;
          const list = variables[name] || (variables[name] = []);
          let index = list.indexOf(value);

          if (index === -1) {
            index = list.length;
            list.push(value);
          }

          return name + "s[" + index + "]";
        }

        return null;
      }

      const fnMap = { __proto__: null, trace, downloadTrace, compileTrace };

      function patch(name, object) {
        return new Proxy(object, {
          get(target, key) {
            if (key in fnMap) return fnMap[key];

            const value = Reflect.get(target, key);
            if (typeof value == "function") {
              return function () {
                const result = value.apply(target, arguments);

                if (frameSincePageLoad !== oldFrameCount) {
                  oldFrameCount = frameSincePageLoad;
                  trace.push("  yield;");
                }

                if (canvas.width !== oldWidth || canvas.height !== oldHeight) {
                  oldWidth = canvas.width;
                  oldHeight = canvas.height;
                  trace.push("  gl.canvas.width = " + oldWidth + ";");
                  trace.push("  gl.canvas.height = " + oldHeight + ";");
                }

                const argToCode = (arg) => {
                  if (
                    typeof arg === "number" ||
                    typeof arg === "boolean" ||
                    typeof arg === "string" ||
                    arg === null
                  ) {
                    return JSON.stringify(arg);
                  } else if (ArrayBuffer.isView(arg)) {
                    return `new ${arg.constructor.name}([${Array.prototype.slice.call(arg)}])`;
                  } else if (arg instanceof ArrayBuffer) {
                    return `new Uint8Array([${new Uint8Array(arg)}]).buffer`;
                  } else if (Array.isArray(arg)) {
                    return `[${arg.map(argToCode).join(",")}]`;
                  } else {
                    const variable = getVariable(arg);
                    if (variable !== null) {
                      return variable;
                    } else {
                      console.warn(
                        "unsupported value:",
                        arg,
                        `in call to ${name}.${key}`,
                      );
                      return "null";
                    }
                  }
                };
                const args = Array.prototype.map.call(arguments, argToCode);

                let text = `${name}.${key}(${args.join(", ")});`;
                const variable = getVariable(result);
                if (variable !== null) text = `${variable} = ${text}`;
                trace.push("  " + text);

                if (result === null) return null;
                if (result === undefined) return undefined;
                // In Firefox, getExtension returns things with constructor.name == 'Object', but in
                // Chrome getExtension returns unique constructor.names.
                if (
                  result.constructor.name === "Object" ||
                  key == "getExtension"
                ) {
                  return patch(variable, result);
                }
                return result;
              };
            } else {
              return value;
            }
          },
        });
      }
      const proxy = patch("gl", context);
      contexts.set(context, proxy);
      return proxy;
    }

    return context;
  };

  countFrames();
})();
