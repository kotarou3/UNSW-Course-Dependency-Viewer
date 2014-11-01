!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.prfun=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
// Utility functions for ES6 Promises.

module.exports = function(Promise) {
  "use strict";

  if (!Promise) { Promise = global.Promise; }
  // Use Promise implementation from es6-shim if there isn't already one
  // installed.
  if (!Promise) { require('es6-shim'); Promise = global.Promise; }

  // ---------- collections --------------

  // Allow Promise.all to accept a promise for an array (or iterable).
  Promise.prototype.all = function() {
    var P = this.constructor || Promise;
    return this.then(function(value) {
      return P.all(value);
    });
  };

  // Like `Promise.all` but generate array from varargs
  Promise.join = function() {
    var P = this || Promise;
    return P.all(arguments);
  };

  // Applies the `callback` to the promised value of each element of the
  // promised array.  Returns a promise for an array of values; that is,
  // it implicitly applies `Promise.all` to resolve all promises returned
  // by the mapping function.
  Promise.prototype.map = function(callback, thisArg) {
    var P = this.constructor || Promise;
    return P.map(this, callback, thisArg);
  };

  var arrayMap = Array.prototype.map;
  Promise.map = function(pArray, callback, thisArg) {
    var P = this || Promise;
    return P.resolve(pArray).then(function(arr) {
      return P.all(arrayMap.call(arr, function(pElem, index, arr_) {
        return P.resolve(pElem).then(function(elem) {
          var t = (thisArg === undefined) ? this : thisArg;
          return callback.call(t, elem, index, arr_);
        });
      }));
    });
  };

  // Applies the `callback` to the promised value of each element of
  // the promised array, and constructs a new array of all the values
  // for which callback returns a (promise of a) true value.
  Promise.prototype.filter = function(callback, thisArg) {
    var P = this.constructor || Promise;
    return P.filter(this, callback, thisArg);
  };

  var arrayFilter = Array.prototype.filter;
  Promise.filter = function(pArray, callback, thisArg) {
    var P = this || Promise;
    return P.resolve(pArray).then(function(arr) {
      var f = new Array(arr.length);
      return P.all(arrayMap.call(arr, function(pElem, index, arr_) {
        return P.resolve(pElem).then(function(elem) {
          var t = (thisArg === undefined) ? this : thisArg;
          var pBool = callback.call(t, elem, index, arr_);
          return P.resolve(pBool).then(function(bool) {
            f[index] = bool;
            return elem;
          });
        });
      })).then(function(resArr) {
        return resArr.filter(function(elem, index) { return f[index]; });
      });
    });
  };

  // Like `Promise.all` but for object properties instead of array items.
  Promise.prototype.props = function() {
    var P = this.constructor || Promise;
    return P.props(this);
  };

  Promise.props = function(pObj) {
    var P = this || Promise;
    return P.resolve(pObj).then(function(obj) {
      var result = {};
      var keys = Object.keys(obj);
      if (Object(obj) !== obj) {
        // Object.keys accepts strings, numbers, etc in ES6.
        throw new TypeError('not an object');
      }
      return P.all(keys.map(function(k) { return obj[k]; })).
        then(function(values) {
          keys.forEach(function(k, i) {
            result[k] = values[i];
          });
          return result;
        });
    });
  };

  // Allow Promise.race to accept a promise for an array (or iterable).
  Promise.prototype.race = function() {
    var P = this.constructor || Promise;
    return this.then(function(value) {
      return P.race(value);
    });
  };

  // helper for reduce/reduceAll
  var reducer = function(P, callback) {
    return function(pPrev, pCurrent, index, arr) {
      return P.resolve(pPrev).then(function(prev) {
        return P.resolve(pCurrent).then(function(current) {
          return callback.call(this, prev, current, index, arr);
        });
      });
    };
  };

  // Reduce left-to-right an array which contains promises.
  Promise.prototype.reduce = function(callback) {
    var P = this.constructor || Promise;
    if (arguments.length <= 1) {
      return P.reduce(this, callback);
    } else {
      return P.reduce(this, callback, arguments[1]);
    }
  };

  var arrayReduce = Array.prototype.reduce;
  Promise.reduce = function(pArray, callback) {
    var P = this || Promise;
    if (arguments.length <= 2) {
      return P.resolve(pArray).then(function(arr) {
        return arrayReduce.call(arr, reducer(P, callback));
      });
    } else {
      var initialValue = P.resolve(arguments[2]);
      return P.resolve(pArray).then(function(arr) {
        return arrayReduce.call(arr, reducer(P, callback), initialValue);
      });
    }
  };

  // Reduce right-to-left an array which contains promises.
  Promise.prototype.reduceRight = function(callback) {
    var P = this.constructor || Promise;
    if (arguments.length <= 1) {
      return P.reduceRight(this, callback);
    } else {
      return P.reduceRight(this, callback, arguments[1]);
    }
  };

  var arrayReduceRight = Array.prototype.reduceRight;
  Promise.reduceRight = function(pArray, callback) {
    var P = this || Promise;
    if (arguments.length <= 2) {
      return P.resolve(pArray).then(function(arr) {
        return arrayReduceRight.call(arr, reducer(P, callback));
      });
    } else {
      var initialValue = P.resolve(arguments[2]);
      return P.resolve(pArray).then(function(arr) {
        return arrayReduceRight.call(arr, reducer(P, callback), initialValue);
      });
    }
  };

  Promise.prototype.spread = function(onFulfilled, onRejected) {
    var P = this.constructor || Promise;
    var f = onFulfilled ? function(pArgs) {
      return P.all(pArgs).then(function(args) {
        return onFulfilled.apply(this, args);
      });
    } : undefined;
    var r = onRejected ? function(pArgs) {
      return P.all(pArgs).then(function(args) {
        return onRejected.apply(this, args);
      });
    } : undefined;
    return this.then(f, r);
  };

  // ---------- Miscellaneous utility functions --------------

  // compatibility with q/when/jquery/etc.
  // use of this interface is discouraged.
  var Deferred = function Deferred() { };
  Object.defineProperties(Deferred.prototype, {
    resolver: {
      enumerable: true,
      get: function() {
        return { resolve: this.resolve, reject: this.reject };
      }
    },
    callback: {
      enumerable: true,
      get: function() {
        var resolve = this.resolve, reject = this.reject;
        return function(err, value) {
          if (err) { return reject(err); }
          return resolve(value);
        };
      }
    }
  });
  Promise.defer = function() {
    var P = this || Promise;
    var deferred = new Deferred();
    deferred.promise = new P(function(resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  };

  Promise.prototype.call = function(propertyName) {
    var P = this.constructor || Promise;
    var pArgs = Array.prototype.slice.call(arguments, 1);
    return this.then(function(obj) {
      return P.all(pArgs).then(function(args) {
        return obj[propertyName].apply(obj, args);
      });
    });
  };

  Promise.prototype.get = function(propertyName) {
    return this.then(function(obj) {
      return obj[propertyName];
    });
  };

  Promise.prototype['return'] = function(v) {
    return this.then(function() { return v; });
  };

  Promise.prototype.tap = function(handler) {
    var P = this.constructor || Promise;
    return this.then(function(v) {
      return P.resolve(handler(v))['return'](v);
    });
  };

  Promise.prototype['throw'] = function(e) {
    // ensure that e is resolved, if it is a promise.
    return this['return'](e).then(function(ee) { throw ee; });
  };

  Promise.prototype.done = function() {
    if (arguments.length > 0) {
      // compatibility
      return this.then.apply(this, arguments).done();
    }
    this['catch'](function(e) {
      // throw from new scope to ensure the exception will be unhandled
      setTimeout(function() { throw e; }, 0);
    });
    // not chainable!
  };

  // ---------- Timeouts and delays --------------

  Promise.prototype.delay = function(ms) {
    var P = this.constructor || Promise;
    return P.delay(this, ms);
  };

  Promise.delay = function(pValue, ms) {
    var P = this || Promise;
    if (arguments.length===1) {
      ms = pValue;
      pValue = undefined;
    }
    return P.resolve(pValue).then(function(value) {
      return new P(function(resolve, reject) {
        setTimeout(function() { resolve(value); }, ms);
      });
    });
  };

  var TimeoutError = Promise.TimeoutError = function(message) {
    this.message = (typeof message === 'string') ? message : 'timeout';
    this.name = 'TimeoutError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  };
  TimeoutError.prototype = Object.create(Error.prototype);

  Promise.prototype.timeout = function(ms, message) {
    var P = this.constructor || Promise;
    var promise = this;
    return new P(function(resolve, reject) {
      promise.then(resolve, reject);
      setTimeout(function() { reject(new TimeoutError(message)); }, ms);
    });
  };

  // ---------- try/caught/finally --------------

  Promise['try'] = function(fn, ctx /* ..args */) {
    var P = this || Promise;
    return P.all(arguments).then(function(args) {
      var fn = args[0], ctx = args[1], rest = args.slice(2);
      return new P(function(resolve, reject) {
        try {
          resolve(fn.apply(ctx, rest));
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  Promise.prototype.caught = function(predicate, handler) {
    var promise = this;
    if (arguments.length<=1) { return promise['catch'](predicate); }
    var predicates = Array.prototype.slice.call(arguments);
    handler = predicates.pop();
    predicates = predicates.map(function(v) {
      /* jshint eqnull: true */
      var isErrorType = (v === Error) ||
        (v != null && v.prototype instanceof Error);
      if (isErrorType) {
        return function(e) { return (e instanceof v); };
      } else if (typeof v === 'function') {
        return function(e) { return !!v(e); };
      } else {
        return function(e) {
          throw new TypeError('caught filter must inherit from Error '+
                              'or be a simple predicate function');
        };
      }
    });
    return promise['catch'](function(e) {
      for (var i=0; i<predicates.length; i++) {
        if (predicates[i](e)) {
          return handler.call(this, e);
        }
      }
      // re-throw
      throw e;
    });
  };

  // XXX The return semantics are a bit funny.
  // eg:
  // > f = function(g, h) { try { return g(); } finally { return h(); } };
  // > f(function(){return 1;}, function(){return 2;})
  // 2
  // > f(function(){return 1;}, function(){throw new Error('b');})
  // Error: b
  // This method would return '1' in the first case (but 'b' in the second).
  Promise.prototype['finally'] = function(handler) {
    var promise = this;
    var P = this.constructor || Promise;
    return new P(function(resolve, reject) {
      promise.then(function(value) {
        var cb = function() { resolve(value); };
        P.resolve().then(handler).then(cb, reject);
      }, function(reason) {
        var cb = function() { reject(reason); };
        P.resolve().then(handler).then(cb, reject);
      });
    });
  };

  // ---------- wrappers and function-writing helpers --------------

  // Transparently handle synchronous exceptions and early returns.
  // This is like `Q.promised`.
  Promise.method = function(fn) {
    var P = this || Promise;
    if (typeof fn !== 'function') {
      throw new TypeError('must wrap a function'); // fail fast
    }
    return function() {
      var self = this;
      var args = [ fn, this ];
      Array.prototype.push.apply(args, arguments);
      return P['try'].apply(P, args);
    };
  };

  // Register a node-style callback on this promise.
  Promise.prototype.nodify = function(callback) {
    var promise = this;
    if (callback) {
      var queueThrow = function(e) {
        // don't let this exception get swallowed by the Promise handlers
        setTimeout(function() { throw e; }, 0);
      };
      promise.then(function(v) {
        try {
          callback.call(this, null, v);
        } catch (e) {
          queueThrow(e);
        }
      }, function(r) {
        try {
          callback.call(this, r);
        } catch (e) {
          queueThrow(e);
        }
      });
    }
    return promise;
  };

  // Returns a function that wraps a given nodeFunction
  Promise.promisify = function(nodeFunction, names, optThis) {
    var P = this || Promise;
    var hasThis = (arguments.length > 2);
    return function() {
      var self = hasThis ? optThis : this;
      var args = Array.prototype.slice.call(arguments);
      return new P(function(resolve, reject) {
        args.push(function(e, v) {
          if (e) {
            reject(e);
          } else if (names === true) {
            resolve(Array.prototype.slice.call(arguments, 1));
          } else if (names) {
            var value = {};
            for (var index in names) {
              value[names[index]] = arguments[(+index) + 1];
            }
            resolve(value);
          } else {
            resolve(v);
          }
        });
        try {
          nodeFunction.apply(self, args);
        } catch(e) {
          reject(e);
        }
      });
    };
  };

  // Guards: limit the amount of parallelism.

  // Implementation borrowed from:
  // https://github.com/cujojs/when/blob/master/guard.js
  // Authors: Brian Cavalier, John Hann, Sakari Jokinen
  // docs at: https://github.com/cujojs/when/blob/master/docs/api.md#whenguard

  /**
   * Creates a guarded version of f that can only be entered when the supplied
   * condition allows.
   * @param {function} condition represents a critical section that may only
   *  be entered when allowed by the condition
   * @param {function} f function to guard
   * @returns {function} guarded version of f
   */
  Promise.guard = function(condition, fn) {
    var P = this || Promise;
    if (typeof condition === 'number') {
      condition = P.guard.n(condition);
    }
    return function() {
      var self, args;

      self = this;
      args = arguments;

      return P.resolve(condition()).then(function(exit) {
        return P.resolve(fn.apply(self, args)).finally(exit);
      });
    };
  };

  /**
   * Creates a condition that allows only n simultaneous executions
   * of a guarded function
   * @param {number} allowed number of allowed simultaneous executions
   * @returns {function} condition function which returns a promise that
   *  fulfills when the critical section may be entered.  The fulfillment
   *  value is a function ("notifyExit") that must be called when the critical
   *  section has been exited.
   */
  Promise.guard.n = function (allowed) {
    var count, waiting;

    count = 0;
    waiting = [];

    var exit = function() {
      if (count > 0) {
        count--;
      }
      if(waiting.length) {
        waiting.shift()(exit);
      }
    };

    return function enter() {
      return new Promise(function(resolve) {
        if(count < allowed) {
          resolve(exit);
        } else {
          waiting.push(resolve);
        }
        count += 1;
      });
    };
  };

  // Promise#bind()
  // Idea borrowed from bluebird.
  Promise.bind = function(newThis) {
    return this.resolve().bind(newThis);
  };

  Promise.prototype.bind = function(newThis) {
    var SuperPromise = this._bindSuper || this.constructor || Promise;
    // create a new Promise subclass (this is less cumbersome in es6, sigh)
    var BoundPromise = function(exec) {
      return SuperPromise.call(this, exec);
    };
    Object.setPrototypeOf(BoundPromise, SuperPromise);
    BoundPromise.prototype = Object.create(SuperPromise.prototype);
    BoundPromise.prototype.constructor = BoundPromise;
    BoundPromise.prototype._bindSuper = SuperPromise;

    BoundPromise.prototype.then = (function(superThen) {
      return function(f, r) {
        var ff = f && f.bind(newThis);
        var rr = r && r.bind(newThis);
        return superThen.call(this, ff, rr);
      };
    })(BoundPromise.prototype.then);
    return newThis ? BoundPromise.resolve(this) : SuperPromise.resolve(this);
  };

  // Generators.
  // Implementation borrowed from Q.async()
  Promise.async = function(makeGenerator) {
    var P = this || Promise;
    return function() {
      var generator, callback, errback;
      // when verb is "send", arg is a value
      // when verb is "throw", arg is an exception
      function continuer(verb, arg) {
        var result;
        try {
          result = generator[verb](arg);
        } catch (exception) {
          return P.reject(exception);
        }
        // xxx: possibly check for array-like (or iterable) value and
        // use Promise.all() before returning/invoking callback?
        if (result.done) {
          return result.value;
        } else {
          return P.resolve(result.value).then(callback, errback);
        }
      }
      generator = makeGenerator.apply(this, arguments);
      callback = continuer.bind(continuer, "next");
      errback = continuer.bind(continuer, "throw");
      return callback();
    };
  };

  return Promise;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"es6-shim":2}],2:[function(require,module,exports){
(function (process){
// ES6-shim 0.18.0 (c) 2013-2014 Paul Miller (http://paulmillr.com)
// ES6-shim may be freely distributed under the MIT license.
// For more details and documentation:
// https://github.com/paulmillr/es6-shim/

(function(undefined) {
  'use strict';

  var isCallableWithoutNew = function(func) {
    try { func(); }
    catch (e) { return false; }
    return true;
  };

  var supportsSubclassing = function(C, f) {
    /* jshint proto:true */
    try {
      var Sub = function() { C.apply(this, arguments); };
      if (!Sub.__proto__) { return false; /* skip test on IE < 11 */ }
      Object.setPrototypeOf(Sub, C);
      Sub.prototype = Object.create(C.prototype, {
        constructor: { value: C }
      });
      return f(Sub);
    } catch (e) {
      return false;
    }
  };

  var arePropertyDescriptorsSupported = function() {
    try {
      Object.defineProperty({}, 'x', {});
      return true;
    } catch (e) { /* this is IE 8. */
      return false;
    }
  };

  var startsWithRejectsRegex = function() {
    var rejectsRegex = false;
    if (String.prototype.startsWith) {
      try {
        '/a/'.startsWith(/a/);
      } catch (e) { /* this is spec compliant */
        rejectsRegex = true;
      }
    }
    return rejectsRegex;
  };

  /*jshint evil: true */
  var getGlobal = new Function('return this;');
  /*jshint evil: false */

  var main = function() {
    var globals = getGlobal();
    var global_isFinite = globals.isFinite;
    var supportsDescriptors = !!Object.defineProperty && arePropertyDescriptorsSupported();
    var startsWithIsCompliant = startsWithRejectsRegex();
    var _slice = Array.prototype.slice;
    var _indexOf = String.prototype.indexOf;
    var _toString = Object.prototype.toString;
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var ArrayIterator; // make our implementation private

    var defineProperty = function(object, name, value, force) {
      if (!force && name in object) return;
      if (supportsDescriptors) {
        Object.defineProperty(object, name, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: value
        });
      } else {
        object[name] = value;
      }
    };

    // Define configurable, writable and non-enumerable props
    // if they don’t exist.
    var defineProperties = function(object, map) {
      Object.keys(map).forEach(function(name) {
        var method = map[name];
        defineProperty(object, name, method, false);
      });
    };

    // Simple shim for Object.create on ES3 browsers
    // (unlike real shim, no attempt to support `prototype === null`)
    var create = Object.create || function(prototype, properties) {
      function Type() {}
      Type.prototype = prototype;
      var object = new Type();
      if (typeof properties !== "undefined") {
        defineProperties(object, properties);
      }
      return object;
    };

    // This is a private name in the es6 spec, equal to '[Symbol.iterator]'
    // we're going to use an arbitrary _-prefixed name to make our shims
    // work properly with each other, even though we don't have full Iterator
    // support.  That is, `Array.from(map.keys())` will work, but we don't
    // pretend to export a "real" Iterator interface.
    var $iterator$ = (typeof Symbol === 'function' && Symbol.iterator) ||
      '_es6shim_iterator_';
    // Firefox ships a partial implementation using the name @@iterator.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=907077#c14
    // So use that name if we detect it.
    if (globals.Set && typeof new globals.Set()['@@iterator'] === 'function') {
      $iterator$ = '@@iterator';
    }
    var addIterator = function(prototype, impl) {
      if (!impl) { impl = function iterator() { return this; }; }
      var o = {};
      o[$iterator$] = impl;
      defineProperties(prototype, o);
      /* jshint notypeof: true */
      if (!prototype[$iterator$] && typeof $iterator$ === 'symbol') {
        // implementations are buggy when $iterator$ is a Symbol
        prototype[$iterator$] = impl;
      }
    };

    // taken directly from https://github.com/ljharb/is-arguments/blob/master/index.js
    // can be replaced with require('is-arguments') if we ever use a build process instead
    var isArguments = function isArguments(value) {
      var str = _toString.call(value);
      var result = str === '[object Arguments]';
      if (!result) {
        result = str !== '[object Array]' &&
          value !== null &&
          typeof value === 'object' &&
          typeof value.length === 'number' &&
          value.length >= 0 &&
          _toString.call(value.callee) === '[object Function]';
      }
      return result;
    };

    var emulateES6construct = function(o) {
      if (!ES.TypeIsObject(o)) throw new TypeError('bad object');
      // es5 approximation to es6 subclass semantics: in es6, 'new Foo'
      // would invoke Foo.@@create to allocation/initialize the new object.
      // In es5 we just get the plain object.  So if we detect an
      // uninitialized object, invoke o.constructor.@@create
      if (!o._es6construct) {
        if (o.constructor && ES.IsCallable(o.constructor['@@create'])) {
          o = o.constructor['@@create'](o);
        }
        defineProperties(o, { _es6construct: true });
      }
      return o;
    };

    var ES = {
      CheckObjectCoercible: function(x, optMessage) {
        /* jshint eqnull:true */
        if (x == null)
          throw new TypeError(optMessage || ('Cannot call method on ' + x));
        return x;
      },

      TypeIsObject: function(x) {
        /* jshint eqnull:true */
        // this is expensive when it returns false; use this function
        // when you expect it to return true in the common case.
        return x != null && Object(x) === x;
      },

      ToObject: function(o, optMessage) {
        return Object(ES.CheckObjectCoercible(o, optMessage));
      },

      IsCallable: function(x) {
        return typeof x === 'function' &&
          // some versions of IE say that typeof /abc/ === 'function'
          _toString.call(x) === '[object Function]';
      },

      ToInt32: function(x) {
        return x >> 0;
      },

      ToUint32: function(x) {
        return x >>> 0;
      },

      ToInteger: function(value) {
        var number = +value;
        if (Number.isNaN(number)) return 0;
        if (number === 0 || !Number.isFinite(number)) return number;
        return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
      },

      ToLength: function(value) {
        var len = ES.ToInteger(value);
        if (len <= 0) return 0; // includes converting -0 to +0
        if (len > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
        return len;
      },

      SameValue: function(a, b) {
        if (a === b) {
          // 0 === -0, but they are not identical.
          if (a === 0) return 1 / a === 1 / b;
          return true;
        }
        return Number.isNaN(a) && Number.isNaN(b);
      },

      SameValueZero: function(a, b) {
        // same as SameValue except for SameValueZero(+0, -0) == true
        return (a === b) || (Number.isNaN(a) && Number.isNaN(b));
      },

      IsIterable: function(o) {
        return ES.TypeIsObject(o) &&
          (o[$iterator$] !== undefined || isArguments(o));
      },

      GetIterator: function(o) {
        if (isArguments(o)) {
          // special case support for `arguments`
          return new ArrayIterator(o, "value");
        }
        var it = o[$iterator$]();
        if (!ES.TypeIsObject(it)) {
          throw new TypeError('bad iterator');
        }
        return it;
      },

      IteratorNext: function (it) {
        var result = arguments.length > 1 ? it.next(arguments[1]) : it.next();
        if (!ES.TypeIsObject(result)) {
          throw new TypeError('bad iterator');
        }
        return result;
      },

      Construct: function(C, args) {
        // CreateFromConstructor
        var obj;
        if (ES.IsCallable(C['@@create'])) {
          obj = C['@@create']();
        } else {
          // OrdinaryCreateFromConstructor
          obj = create(C.prototype || null);
        }
        // Mark that we've used the es6 construct path
        // (see emulateES6construct)
        defineProperties(obj, { _es6construct: true });
        // Call the constructor.
        var result = C.apply(obj, args);
        return ES.TypeIsObject(result) ? result : obj;
      }
    };

    var numberConversion = (function () {
      // from https://github.com/inexorabletash/polyfill/blob/master/typedarray.js#L176-L266
      // with permission and license, per https://twitter.com/inexorabletash/status/372206509540659200

      function roundToEven(n) {
        var w = Math.floor(n), f = n - w;
        if (f < 0.5) {
          return w;
        }
        if (f > 0.5) {
          return w + 1;
        }
        return w % 2 ? w + 1 : w;
      }

      function packIEEE754(v, ebits, fbits) {
        var bias = (1 << (ebits - 1)) - 1,
          s, e, f, ln,
          i, bits, str, bytes;

        // Compute sign, exponent, fraction
        if (v !== v) {
          // NaN
          // http://dev.w3.org/2006/webapi/WebIDL/#es-type-mapping
          e = (1 << ebits) - 1;
          f = Math.pow(2, fbits - 1);
          s = 0;
        } else if (v === Infinity || v === -Infinity) {
          e = (1 << ebits) - 1;
          f = 0;
          s = (v < 0) ? 1 : 0;
        } else if (v === 0) {
          e = 0;
          f = 0;
          s = (1 / v === -Infinity) ? 1 : 0;
        } else {
          s = v < 0;
          v = Math.abs(v);

          if (v >= Math.pow(2, 1 - bias)) {
            e = Math.min(Math.floor(Math.log(v) / Math.LN2), 1023);
            f = roundToEven(v / Math.pow(2, e) * Math.pow(2, fbits));
            if (f / Math.pow(2, fbits) >= 2) {
              e = e + 1;
              f = 1;
            }
            if (e > bias) {
              // Overflow
              e = (1 << ebits) - 1;
              f = 0;
            } else {
              // Normal
              e = e + bias;
              f = f - Math.pow(2, fbits);
            }
          } else {
            // Subnormal
            e = 0;
            f = roundToEven(v / Math.pow(2, 1 - bias - fbits));
          }
        }

        // Pack sign, exponent, fraction
        bits = [];
        for (i = fbits; i; i -= 1) {
          bits.push(f % 2 ? 1 : 0);
          f = Math.floor(f / 2);
        }
        for (i = ebits; i; i -= 1) {
          bits.push(e % 2 ? 1 : 0);
          e = Math.floor(e / 2);
        }
        bits.push(s ? 1 : 0);
        bits.reverse();
        str = bits.join('');

        // Bits to bytes
        bytes = [];
        while (str.length) {
          bytes.push(parseInt(str.slice(0, 8), 2));
          str = str.slice(8);
        }
        return bytes;
      }

      function unpackIEEE754(bytes, ebits, fbits) {
        // Bytes to bits
        var bits = [], i, j, b, str,
            bias, s, e, f;

        for (i = bytes.length; i; i -= 1) {
          b = bytes[i - 1];
          for (j = 8; j; j -= 1) {
            bits.push(b % 2 ? 1 : 0);
            b = b >> 1;
          }
        }
        bits.reverse();
        str = bits.join('');

        // Unpack sign, exponent, fraction
        bias = (1 << (ebits - 1)) - 1;
        s = parseInt(str.slice(0, 1), 2) ? -1 : 1;
        e = parseInt(str.slice(1, 1 + ebits), 2);
        f = parseInt(str.slice(1 + ebits), 2);

        // Produce number
        if (e === (1 << ebits) - 1) {
          return f !== 0 ? NaN : s * Infinity;
        } else if (e > 0) {
          // Normalized
          return s * Math.pow(2, e - bias) * (1 + f / Math.pow(2, fbits));
        } else if (f !== 0) {
          // Denormalized
          return s * Math.pow(2, -(bias - 1)) * (f / Math.pow(2, fbits));
        } else {
          return s < 0 ? -0 : 0;
        }
      }

      function unpackFloat64(b) { return unpackIEEE754(b, 11, 52); }
      function packFloat64(v) { return packIEEE754(v, 11, 52); }
      function unpackFloat32(b) { return unpackIEEE754(b, 8, 23); }
      function packFloat32(v) { return packIEEE754(v, 8, 23); }

      var conversions = {
        toFloat32: function (num) { return unpackFloat32(packFloat32(num)); }
      };
      if (typeof Float32Array !== 'undefined') {
        var float32array = new Float32Array(1);
        conversions.toFloat32 = function (num) {
          float32array[0] = num;
          return float32array[0];
        };
      }
      return conversions;
    }());

    defineProperties(String, {
      fromCodePoint: function(_) { // length = 1
        var points = _slice.call(arguments, 0, arguments.length);
        var result = [];
        var next;
        for (var i = 0, length = points.length; i < length; i++) {
          next = Number(points[i]);
          if (!ES.SameValue(next, ES.ToInteger(next)) ||
              next < 0 || next > 0x10FFFF) {
            throw new RangeError('Invalid code point ' + next);
          }

          if (next < 0x10000) {
            result.push(String.fromCharCode(next));
          } else {
            next -= 0x10000;
            result.push(String.fromCharCode((next >> 10) + 0xD800));
            result.push(String.fromCharCode((next % 0x400) + 0xDC00));
          }
        }
        return result.join('');
      },

      raw: function(callSite) { // raw.length===1
        var substitutions = _slice.call(arguments, 1, arguments.length);
        var cooked = ES.ToObject(callSite, 'bad callSite');
        var rawValue = cooked.raw;
        var raw = ES.ToObject(rawValue, 'bad raw value');
        var len = Object.keys(raw).length;
        var literalsegments = ES.ToLength(len);
        if (literalsegments === 0) {
          return '';
        }

        var stringElements = [];
        var nextIndex = 0;
        var nextKey, next, nextSeg, nextSub;
        while (nextIndex < literalsegments) {
          nextKey = String(nextIndex);
          next = raw[nextKey];
          nextSeg = String(next);
          stringElements.push(nextSeg);
          if (nextIndex + 1 >= literalsegments) {
            break;
          }
          next = substitutions[nextKey];
          if (next === undefined) {
            break;
          }
          nextSub = String(next);
          stringElements.push(nextSub);
          nextIndex++;
        }
        return stringElements.join('');
      }
    });

    // Firefox 31 reports this function's length as 0
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1062484
    if (String.fromCodePoint.length !== 1) {
      var originalFromCodePoint = String.fromCodePoint;
      defineProperty(String, 'fromCodePoint', function (_) { return originalFromCodePoint.apply(this, arguments); }, true);
    }

    var StringShims = {
      // Fast repeat, uses the `Exponentiation by squaring` algorithm.
      // Perf: http://jsperf.com/string-repeat2/2
      repeat: (function() {
        var repeat = function(s, times) {
          if (times < 1) return '';
          if (times % 2) return repeat(s, times - 1) + s;
          var half = repeat(s, times / 2);
          return half + half;
        };

        return function(times) {
          var thisStr = String(ES.CheckObjectCoercible(this));
          times = ES.ToInteger(times);
          if (times < 0 || times === Infinity) {
            throw new RangeError('Invalid String#repeat value');
          }
          return repeat(thisStr, times);
        };
      })(),

      startsWith: function(searchStr) {
        var thisStr = String(ES.CheckObjectCoercible(this));
        if (_toString.call(searchStr) === '[object RegExp]') throw new TypeError('Cannot call method "startsWith" with a regex');
        searchStr = String(searchStr);
        var startArg = arguments.length > 1 ? arguments[1] : undefined;
        var start = Math.max(ES.ToInteger(startArg), 0);
        return thisStr.slice(start, start + searchStr.length) === searchStr;
      },

      endsWith: function(searchStr) {
        var thisStr = String(ES.CheckObjectCoercible(this));
        if (_toString.call(searchStr) === '[object RegExp]') throw new TypeError('Cannot call method "endsWith" with a regex');
        searchStr = String(searchStr);
        var thisLen = thisStr.length;
        var posArg = arguments.length > 1 ? arguments[1] : undefined;
        var pos = posArg === undefined ? thisLen : ES.ToInteger(posArg);
        var end = Math.min(Math.max(pos, 0), thisLen);
        return thisStr.slice(end - searchStr.length, end) === searchStr;
      },

      contains: function(searchString) {
        var position = arguments.length > 1 ? arguments[1] : undefined;
        // Somehow this trick makes method 100% compat with the spec.
        return _indexOf.call(this, searchString, position) !== -1;
      },

      codePointAt: function(pos) {
        var thisStr = String(ES.CheckObjectCoercible(this));
        var position = ES.ToInteger(pos);
        var length = thisStr.length;
        if (position < 0 || position >= length) return undefined;
        var first = thisStr.charCodeAt(position);
        var isEnd = (position + 1 === length);
        if (first < 0xD800 || first > 0xDBFF || isEnd) return first;
        var second = thisStr.charCodeAt(position + 1);
        if (second < 0xDC00 || second > 0xDFFF) return first;
        return ((first - 0xD800) * 1024) + (second - 0xDC00) + 0x10000;
      }
    };
    defineProperties(String.prototype, StringShims);

    var hasStringTrimBug = '\u0085'.trim().length !== 1;
    if (hasStringTrimBug) {
      var originalStringTrim = String.prototype.trim;
      delete String.prototype.trim;
      // whitespace from: http://es5.github.io/#x15.5.4.20
      // implementation from https://github.com/es-shims/es5-shim/blob/v3.4.0/es5-shim.js#L1304-L1324
      var ws = [
        '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003',
        '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028',
        '\u2029\uFEFF'
      ].join('');
      var trimRegexp = new RegExp('(^[' + ws + ']+)|([' + ws + ']+$)', 'g');
      defineProperties(String.prototype, {
        trim: function() {
          if (this === undefined || this === null) {
            throw new TypeError("can't convert " + this + " to object");
          }
          return String(this).replace(trimRegexp, "");
        }
      });
    }

    // see https://people.mozilla.org/~jorendorff/es6-draft.html#sec-string.prototype-@@iterator
    var StringIterator = function(s) {
      this._s = String(ES.CheckObjectCoercible(s));
      this._i = 0;
    };
    StringIterator.prototype.next = function() {
      var s = this._s, i = this._i;
      if (s === undefined || i >= s.length) {
        this._s = undefined;
        return { value: undefined, done: true };
      }
      var first = s.charCodeAt(i), second, len;
      if (first < 0xD800 || first > 0xDBFF || (i+1) == s.length) {
        len = 1;
      } else {
        second = s.charCodeAt(i+1);
        len = (second < 0xDC00 || second > 0xDFFF) ? 1 : 2;
      }
      this._i = i + len;
      return { value: s.substr(i, len), done: false };
    };
    addIterator(StringIterator.prototype);
    addIterator(String.prototype, function() {
      return new StringIterator(this);
    });

    if (!startsWithIsCompliant) {
      // Firefox has a noncompliant startsWith implementation
      String.prototype.startsWith = StringShims.startsWith;
      String.prototype.endsWith = StringShims.endsWith;
    }

    var ArrayShims = {
      from: function(iterable) {
        var mapFn = arguments.length > 1 ? arguments[1] : undefined;

        var list = ES.ToObject(iterable, 'bad iterable');
        if (mapFn !== undefined && !ES.IsCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function');
        }

        var hasThisArg = arguments.length > 2;
        var thisArg = hasThisArg ? arguments[2] : undefined;

        var usingIterator = ES.IsIterable(list);
        // does the spec really mean that Arrays should use ArrayIterator?
        // https://bugs.ecmascript.org/show_bug.cgi?id=2416
        //if (Array.isArray(list)) { usingIterator=false; }

        var length;
        var result, i, value;
        if (usingIterator) {
          i = 0;
          result = ES.IsCallable(this) ? Object(new this()) : [];
          var it = usingIterator ? ES.GetIterator(list) : null;
          var iterationValue;

          do {
            iterationValue = ES.IteratorNext(it);
            if (!iterationValue.done) {
              value = iterationValue.value;
              if (mapFn) {
                result[i] = hasThisArg ? mapFn.call(thisArg, value, i) : mapFn(value, i);
              } else {
                result[i] = value;
              }
              i += 1;
            }
          } while (!iterationValue.done);
          length = i;
        } else {
          length = ES.ToLength(list.length);
          result = ES.IsCallable(this) ? Object(new this(length)) : new Array(length);
          for (i = 0; i < length; ++i) {
            value = list[i];
            if (mapFn) {
              result[i] = hasThisArg ? mapFn.call(thisArg, value, i) : mapFn(value, i);
            } else {
              result[i] = value;
            }
          }
        }

        result.length = length;
        return result;
      },

      of: function() {
        return Array.from(arguments);
      }
    };
    defineProperties(Array, ArrayShims);

    var arrayFromSwallowsNegativeLengths = function () {
      try {
        return Array.from({ length: -1 }).length === 0;
      } catch (e) {
        return false;
      }
    };
    // Fixes a Firefox bug in v32
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1063993
    if (!arrayFromSwallowsNegativeLengths()) {
      defineProperty(Array, 'from', ArrayShims.from, true);
    }

    // Our ArrayIterator is private; see
    // https://github.com/paulmillr/es6-shim/issues/252
    ArrayIterator = function(array, kind) {
        this.i = 0;
        this.array = array;
        this.kind = kind;
    };

    defineProperties(ArrayIterator.prototype, {
      next: function() {
        var i = this.i, array = this.array;
        if (!(this instanceof ArrayIterator)) {
          throw new TypeError('Not an ArrayIterator');
        }
        if (array !== undefined) {
          var len = ES.ToLength(array.length);
          for (; i < len; i++) {
            var kind = this.kind;
            var retval;
            if (kind === "key") {
              retval = i;
            } else if (kind === "value") {
              retval = array[i];
            } else if (kind === "entry") {
              retval = [i, array[i]];
            }
            this.i = i + 1;
            return { value: retval, done: false };
          }
        }
        this.array = undefined;
        return { value: undefined, done: true };
      }
    });
    addIterator(ArrayIterator.prototype);

    var ArrayPrototypeShims = {
      copyWithin: function(target, start) {
        var end = arguments[2]; // copyWithin.length must be 2
        var o = ES.ToObject(this);
        var len = ES.ToLength(o.length);
        target = ES.ToInteger(target);
        start = ES.ToInteger(start);
        var to = target < 0 ? Math.max(len + target, 0) : Math.min(target, len);
        var from = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
        end = (end===undefined) ? len : ES.ToInteger(end);
        var fin = end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
        var count = Math.min(fin - from, len - to);
        var direction = 1;
        if (from < to && to < (from + count)) {
          direction = -1;
          from += count - 1;
          to += count - 1;
        }
        while (count > 0) {
          if (_hasOwnProperty.call(o, from)) {
            o[to] = o[from];
          } else {
            delete o[from];
          }
          from += direction;
          to += direction;
          count -= 1;
        }
        return o;
      },

      fill: function(value) {
        var start = arguments.length > 1 ? arguments[1] : undefined;
        var end = arguments.length > 2 ? arguments[2] : undefined;
        var O = ES.ToObject(this);
        var len = ES.ToLength(O.length);
        start = ES.ToInteger(start === undefined ? 0 : start);
        end = ES.ToInteger(end === undefined ? len : end);

        var relativeStart = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
        var relativeEnd = end < 0 ? len + end : end;

        for (var i = relativeStart; i < len && i < relativeEnd; ++i) {
          O[i] = value;
        }
        return O;
      },

      find: function find(predicate) {
        var list = ES.ToObject(this);
        var length = ES.ToLength(list.length);
        if (!ES.IsCallable(predicate)) {
          throw new TypeError('Array#find: predicate must be a function');
        }
        var thisArg = arguments[1];
        for (var i = 0, value; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) { return value; }
        }
        return undefined;
      },

      findIndex: function findIndex(predicate) {
        var list = ES.ToObject(this);
        var length = ES.ToLength(list.length);
        if (!ES.IsCallable(predicate)) {
          throw new TypeError('Array#findIndex: predicate must be a function');
        }
        var thisArg = arguments[1];
        for (var i = 0; i < length; i++) {
          if (predicate.call(thisArg, list[i], i, list)) { return i; }
        }
        return -1;
      },

      keys: function() {
        return new ArrayIterator(this, "key");
      },

      values: function() {
        return new ArrayIterator(this, "value");
      },

      entries: function() {
        return new ArrayIterator(this, "entry");
      }
    };
    defineProperties(Array.prototype, ArrayPrototypeShims);
    addIterator(Array.prototype, function() { return this.values(); });
    // Chrome defines keys/values/entries on Array, but doesn't give us
    // any way to identify its iterator.  So add our own shimmed field.
    if (Object.getPrototypeOf) {
      addIterator(Object.getPrototypeOf([].values()));
    }

    var maxSafeInteger = Math.pow(2, 53) - 1;
    defineProperties(Number, {
      MAX_SAFE_INTEGER: maxSafeInteger,
      MIN_SAFE_INTEGER: -maxSafeInteger,
      EPSILON: 2.220446049250313e-16,

      parseInt: globals.parseInt,
      parseFloat: globals.parseFloat,

      isFinite: function(value) {
        return typeof value === 'number' && global_isFinite(value);
      },

      isInteger: function(value) {
        return Number.isFinite(value) &&
          ES.ToInteger(value) === value;
      },

      isSafeInteger: function(value) {
        return Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
      },

      isNaN: function(value) {
        // NaN !== NaN, but they are identical.
        // NaNs are the only non-reflexive value, i.e., if x !== x,
        // then x is NaN.
        // isNaN is broken: it converts its argument to number, so
        // isNaN('foo') => true
        return value !== value;
      }

    });

    // Work around bugs in Array#find and Array#findIndex -- early
    // implementations skipped holes in sparse arrays. (Note that the
    // implementations of find/findIndex indirectly use shimmed
    // methods of Number, so this test has to happen down here.)
    if (![, 1].find(function(item, idx) { return idx === 0; })) {
      defineProperty(Array.prototype, 'find', ArrayPrototypeShims.find, true);
    }
    if ([, 1].findIndex(function(item, idx) { return idx === 0; }) !== 0) {
      defineProperty(Array.prototype, 'findIndex', ArrayPrototypeShims.findIndex, true);
    }

    if (supportsDescriptors) {
      defineProperties(Object, {
        getPropertyDescriptor: function(subject, name) {
          var pd = Object.getOwnPropertyDescriptor(subject, name);
          var proto = Object.getPrototypeOf(subject);
          while (pd === undefined && proto !== null) {
            pd = Object.getOwnPropertyDescriptor(proto, name);
            proto = Object.getPrototypeOf(proto);
          }
          return pd;
        },

        getPropertyNames: function(subject) {
          var result = Object.getOwnPropertyNames(subject);
          var proto = Object.getPrototypeOf(subject);

          var addProperty = function(property) {
            if (result.indexOf(property) === -1) {
              result.push(property);
            }
          };

          while (proto !== null) {
            Object.getOwnPropertyNames(proto).forEach(addProperty);
            proto = Object.getPrototypeOf(proto);
          }
          return result;
        }
      });

      defineProperties(Object, {
        // 19.1.3.1
        assign: function(target, source) {
          if (!ES.TypeIsObject(target)) {
            throw new TypeError('target must be an object');
          }
          return Array.prototype.reduce.call(arguments, function(target, source) {
            return Object.keys(Object(source)).reduce(function(target, key) {
              target[key] = source[key];
              return target;
            }, target);
          });
        },

        is: function(a, b) {
          return ES.SameValue(a, b);
        },

        // 19.1.3.9
        // shim from https://gist.github.com/WebReflection/5593554
        setPrototypeOf: (function(Object, magic) {
          var set;

          var checkArgs = function(O, proto) {
            if (!ES.TypeIsObject(O)) {
              throw new TypeError('cannot set prototype on a non-object');
            }
            if (!(proto===null || ES.TypeIsObject(proto))) {
              throw new TypeError('can only set prototype to an object or null'+proto);
            }
          };

          var setPrototypeOf = function(O, proto) {
            checkArgs(O, proto);
            set.call(O, proto);
            return O;
          };

          try {
            // this works already in Firefox and Safari
            set = Object.getOwnPropertyDescriptor(Object.prototype, magic).set;
            set.call({}, null);
          } catch (e) {
            if (Object.prototype !== {}[magic]) {
              // IE < 11 cannot be shimmed
              return;
            }
            // probably Chrome or some old Mobile stock browser
            set = function(proto) {
              this[magic] = proto;
            };
            // please note that this will **not** work
            // in those browsers that do not inherit
            // __proto__ by mistake from Object.prototype
            // in these cases we should probably throw an error
            // or at least be informed about the issue
            setPrototypeOf.polyfill = setPrototypeOf(
              setPrototypeOf({}, null),
              Object.prototype
            ) instanceof Object;
            // setPrototypeOf.polyfill === true means it works as meant
            // setPrototypeOf.polyfill === false means it's not 100% reliable
            // setPrototypeOf.polyfill === undefined
            // or
            // setPrototypeOf.polyfill ==  null means it's not a polyfill
            // which means it works as expected
            // we can even delete Object.prototype.__proto__;
          }
          return setPrototypeOf;
        })(Object, '__proto__')
      });
    }

    // Workaround bug in Opera 12 where setPrototypeOf(x, null) doesn't work,
    // but Object.create(null) does.
    if (Object.setPrototypeOf && Object.getPrototypeOf &&
        Object.getPrototypeOf(Object.setPrototypeOf({}, null)) !== null &&
        Object.getPrototypeOf(Object.create(null)) === null) {
      (function() {
        var FAKENULL = Object.create(null);
        var gpo = Object.getPrototypeOf, spo = Object.setPrototypeOf;
        Object.getPrototypeOf = function(o) {
          var result = gpo(o);
          return result === FAKENULL ? null : result;
        };
        Object.setPrototypeOf = function(o, p) {
          if (p === null) { p = FAKENULL; }
          return spo(o, p);
        };
        Object.setPrototypeOf.polyfill = false;
      })();
    }

    try {
      Object.keys('foo');
    } catch (e) {
      var originalObjectKeys = Object.keys;
      Object.keys = function (obj) {
        return originalObjectKeys(ES.ToObject(obj));
      };
    }

    var MathShims = {
      acosh: function(value) {
        value = Number(value);
        if (Number.isNaN(value) || value < 1) return NaN;
        if (value === 1) return 0;
        if (value === Infinity) return value;
        return Math.log(value + Math.sqrt(value * value - 1));
      },

      asinh: function(value) {
        value = Number(value);
        if (value === 0 || !global_isFinite(value)) {
          return value;
        }
        return value < 0 ? -Math.asinh(-value) : Math.log(value + Math.sqrt(value * value + 1));
      },

      atanh: function(value) {
        value = Number(value);
        if (Number.isNaN(value) || value < -1 || value > 1) {
          return NaN;
        }
        if (value === -1) return -Infinity;
        if (value === 1) return Infinity;
        if (value === 0) return value;
        return 0.5 * Math.log((1 + value) / (1 - value));
      },

      cbrt: function(value) {
        value = Number(value);
        if (value === 0) return value;
        var negate = value < 0, result;
        if (negate) value = -value;
        result = Math.pow(value, 1/3);
        return negate ? -result : result;
      },

      clz32: function(value) {
        // See https://bugs.ecmascript.org/show_bug.cgi?id=2465
        value = Number(value);
        var number = ES.ToUint32(value);
        if (number === 0) {
          return 32;
        }
        return 32 - (number).toString(2).length;
      },

      cosh: function(value) {
        value = Number(value);
        if (value === 0) return 1; // +0 or -0
        if (Number.isNaN(value)) return NaN;
        if (!global_isFinite(value)) return Infinity;
        if (value < 0) value = -value;
        if (value > 21) return Math.exp(value) / 2;
        return (Math.exp(value) + Math.exp(-value)) / 2;
      },

      expm1: function(value) {
        value = Number(value);
        if (value === -Infinity) return -1;
        if (!global_isFinite(value) || value === 0) return value;
        return Math.exp(value) - 1;
      },

      hypot: function(x, y) {
        var anyNaN = false;
        var allZero = true;
        var anyInfinity = false;
        var numbers = [];
        Array.prototype.every.call(arguments, function(arg) {
          var num = Number(arg);
          if (Number.isNaN(num)) anyNaN = true;
          else if (num === Infinity || num === -Infinity) anyInfinity = true;
          else if (num !== 0) allZero = false;
          if (anyInfinity) {
            return false;
          } else if (!anyNaN) {
            numbers.push(Math.abs(num));
          }
          return true;
        });
        if (anyInfinity) return Infinity;
        if (anyNaN) return NaN;
        if (allZero) return 0;

        numbers.sort(function (a, b) { return b - a; });
        var largest = numbers[0];
        var divided = numbers.map(function (number) { return number / largest; });
        var sum = divided.reduce(function (sum, number) { return sum += number * number; }, 0);
        return largest * Math.sqrt(sum);
      },

      log2: function(value) {
        return Math.log(value) * Math.LOG2E;
      },

      log10: function(value) {
        return Math.log(value) * Math.LOG10E;
      },

      log1p: function(value) {
        value = Number(value);
        if (value < -1 || Number.isNaN(value)) return NaN;
        if (value === 0 || value === Infinity) return value;
        if (value === -1) return -Infinity;
        var result = 0;
        var n = 50;

        if (value < 0 || value > 1) return Math.log(1 + value);
        for (var i = 1; i < n; i++) {
          if ((i % 2) === 0) {
            result -= Math.pow(value, i) / i;
          } else {
            result += Math.pow(value, i) / i;
          }
        }

        return result;
      },

      sign: function(value) {
        var number = +value;
        if (number === 0) return number;
        if (Number.isNaN(number)) return number;
        return number < 0 ? -1 : 1;
      },

      sinh: function(value) {
        value = Number(value);
        if (!global_isFinite(value) || value === 0) return value;
        return (Math.exp(value) - Math.exp(-value)) / 2;
      },

      tanh: function(value) {
        value = Number(value);
        if (Number.isNaN(value) || value === 0) return value;
        if (value === Infinity) return 1;
        if (value === -Infinity) return -1;
        return (Math.exp(value) - Math.exp(-value)) / (Math.exp(value) + Math.exp(-value));
      },

      trunc: function(value) {
        var number = Number(value);
        return number < 0 ? -Math.floor(-number) : Math.floor(number);
      },

      imul: function(x, y) {
        // taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
        x = ES.ToUint32(x);
        y = ES.ToUint32(y);
        var ah  = (x >>> 16) & 0xffff;
        var al = x & 0xffff;
        var bh  = (y >>> 16) & 0xffff;
        var bl = y & 0xffff;
        // the shift by 0 fixes the sign on the high part
        // the final |0 converts the unsigned value into a signed value
        return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);
      },

      fround: function(x) {
        if (x === 0 || x === Infinity || x === -Infinity || Number.isNaN(x)) {
          return x;
        }
        var num = Number(x);
        return numberConversion.toFloat32(num);
      }
    };
    defineProperties(Math, MathShims);

    if (Math.imul(0xffffffff, 5) !== -5) {
      // Safari 6.1, at least, reports "0" for this value
      Math.imul = MathShims.imul;
    }

    // Promises
    // Simplest possible implementation; use a 3rd-party library if you
    // want the best possible speed and/or long stack traces.
    var PromiseShim = (function() {

      var Promise, Promise$prototype;

      ES.IsPromise = function(promise) {
        if (!ES.TypeIsObject(promise)) {
          return false;
        }
        if (!promise._promiseConstructor) {
          // _promiseConstructor is a bit more unique than _status, so we'll
          // check that instead of the [[PromiseStatus]] internal field.
          return false;
        }
        if (promise._status === undefined) {
          return false; // uninitialized
        }
        return true;
      };

      // "PromiseCapability" in the spec is what most promise implementations
      // call a "deferred".
      var PromiseCapability = function(C) {
        if (!ES.IsCallable(C)) {
          throw new TypeError('bad promise constructor');
        }
        var capability = this;
        var resolver = function(resolve, reject) {
          capability.resolve = resolve;
          capability.reject = reject;
        };
        capability.promise = ES.Construct(C, [resolver]);
        // see https://bugs.ecmascript.org/show_bug.cgi?id=2478
        if (!capability.promise._es6construct) {
          throw new TypeError('bad promise constructor');
        }
        if (!(ES.IsCallable(capability.resolve) &&
              ES.IsCallable(capability.reject))) {
          throw new TypeError('bad promise constructor');
        }
      };

      // find an appropriate setImmediate-alike
      var setTimeout = globals.setTimeout;
      var makeZeroTimeout;
      if (typeof window !== 'undefined' && ES.IsCallable(window.postMessage)) {
        makeZeroTimeout = function() {
          // from http://dbaron.org/log/20100309-faster-timeouts
          var timeouts = [];
          var messageName = "zero-timeout-message";
          var setZeroTimeout = function(fn) {
            timeouts.push(fn);
            window.postMessage(messageName, "*");
          };
          var handleMessage = function(event) {
            if (event.source == window && event.data == messageName) {
              event.stopPropagation();
              if (timeouts.length === 0) { return; }
              var fn = timeouts.shift();
              fn();
            }
          };
          window.addEventListener("message", handleMessage, true);
          return setZeroTimeout;
        };
      }
      var makePromiseAsap = function() {
        // An efficient task-scheduler based on a pre-existing Promise
        // implementation, which we can use even if we override the
        // global Promise below (in order to workaround bugs)
        // https://github.com/Raynos/observ-hash/issues/2#issuecomment-35857671
        var P = globals.Promise;
        return P && P.resolve && function(task) {
          return P.resolve().then(task);
        };
      };
      var enqueue = ES.IsCallable(globals.setImmediate) ?
        globals.setImmediate.bind(globals) :
        typeof process === 'object' && process.nextTick ? process.nextTick :
        makePromiseAsap() ||
        (ES.IsCallable(makeZeroTimeout) ? makeZeroTimeout() :
        function(task) { setTimeout(task, 0); }); // fallback

      var triggerPromiseReactions = function(reactions, x) {
        reactions.forEach(function(reaction) {
          enqueue(function() {
            // PromiseReactionTask
            var handler = reaction.handler;
            var capability = reaction.capability;
            var resolve = capability.resolve;
            var reject = capability.reject;
            try {
              var result = handler(x);
              if (result === capability.promise) {
                throw new TypeError('self resolution');
              }
              var updateResult =
                updatePromiseFromPotentialThenable(result, capability);
              if (!updateResult) {
                resolve(result);
              }
            } catch (e) {
              reject(e);
            }
          });
        });
      };

      var updatePromiseFromPotentialThenable = function(x, capability) {
        if (!ES.TypeIsObject(x)) {
          return false;
        }
        var resolve = capability.resolve;
        var reject = capability.reject;
        try {
          var then = x.then; // only one invocation of accessor
          if (!ES.IsCallable(then)) { return false; }
          then.call(x, resolve, reject);
        } catch(e) {
          reject(e);
        }
        return true;
      };

      var promiseResolutionHandler = function(promise, onFulfilled, onRejected){
        return function(x) {
          if (x === promise) {
            return onRejected(new TypeError('self resolution'));
          }
          var C = promise._promiseConstructor;
          var capability = new PromiseCapability(C);
          var updateResult = updatePromiseFromPotentialThenable(x, capability);
          if (updateResult) {
            return capability.promise.then(onFulfilled, onRejected);
          } else {
            return onFulfilled(x);
          }
        };
      };

      Promise = function(resolver) {
        var promise = this;
        promise = emulateES6construct(promise);
        if (!promise._promiseConstructor) {
          // we use _promiseConstructor as a stand-in for the internal
          // [[PromiseStatus]] field; it's a little more unique.
          throw new TypeError('bad promise');
        }
        if (promise._status !== undefined) {
          throw new TypeError('promise already initialized');
        }
        // see https://bugs.ecmascript.org/show_bug.cgi?id=2482
        if (!ES.IsCallable(resolver)) {
          throw new TypeError('not a valid resolver');
        }
        promise._status = 'unresolved';
        promise._resolveReactions = [];
        promise._rejectReactions = [];

        var resolve = function(resolution) {
          if (promise._status !== 'unresolved') { return; }
          var reactions = promise._resolveReactions;
          promise._result = resolution;
          promise._resolveReactions = undefined;
          promise._rejectReactions = undefined;
          promise._status = 'has-resolution';
          triggerPromiseReactions(reactions, resolution);
        };
        var reject = function(reason) {
          if (promise._status !== 'unresolved') { return; }
          var reactions = promise._rejectReactions;
          promise._result = reason;
          promise._resolveReactions = undefined;
          promise._rejectReactions = undefined;
          promise._status = 'has-rejection';
          triggerPromiseReactions(reactions, reason);
        };
        try {
          resolver(resolve, reject);
        } catch (e) {
          reject(e);
        }
        return promise;
      };
      Promise$prototype = Promise.prototype;
      defineProperties(Promise, {
        '@@create': function(obj) {
          var constructor = this;
          // AllocatePromise
          // The `obj` parameter is a hack we use for es5
          // compatibility.
          var prototype = constructor.prototype || Promise$prototype;
          obj = obj || create(prototype);
          defineProperties(obj, {
            _status: undefined,
            _result: undefined,
            _resolveReactions: undefined,
            _rejectReactions: undefined,
            _promiseConstructor: undefined
          });
          obj._promiseConstructor = constructor;
          return obj;
        }
      });

      var _promiseAllResolver = function(index, values, capability, remaining) {
        var done = false;
        return function(x) {
          if (done) { return; } // protect against being called multiple times
          done = true;
          values[index] = x;
          if ((--remaining.count) === 0) {
            var resolve = capability.resolve;
            resolve(values); // call w/ this===undefined
          }
        };
      };

      Promise.all = function(iterable) {
        var C = this;
        var capability = new PromiseCapability(C);
        var resolve = capability.resolve;
        var reject = capability.reject;
        try {
          if (!ES.IsIterable(iterable)) {
            throw new TypeError('bad iterable');
          }
          var it = ES.GetIterator(iterable);
          var values = [], remaining = { count: 1 };
          for (var index = 0; ; index++) {
            var next = ES.IteratorNext(it);
            if (next.done) {
              break;
            }
            var nextPromise = C.resolve(next.value);
            var resolveElement = _promiseAllResolver(
              index, values, capability, remaining
            );
            remaining.count++;
            nextPromise.then(resolveElement, capability.reject);
          }
          if ((--remaining.count) === 0) {
            resolve(values); // call w/ this===undefined
          }
        } catch (e) {
          reject(e);
        }
        return capability.promise;
      };

      Promise.race = function(iterable) {
        var C = this;
        var capability = new PromiseCapability(C);
        var resolve = capability.resolve;
        var reject = capability.reject;
        try {
          if (!ES.IsIterable(iterable)) {
            throw new TypeError('bad iterable');
          }
          var it = ES.GetIterator(iterable);
          while (true) {
            var next = ES.IteratorNext(it);
            if (next.done) {
              // If iterable has no items, resulting promise will never
              // resolve; see:
              // https://github.com/domenic/promises-unwrapping/issues/75
              // https://bugs.ecmascript.org/show_bug.cgi?id=2515
              break;
            }
            var nextPromise = C.resolve(next.value);
            nextPromise.then(resolve, reject);
          }
        } catch (e) {
          reject(e);
        }
        return capability.promise;
      };

      Promise.reject = function(reason) {
        var C = this;
        var capability = new PromiseCapability(C);
        var reject = capability.reject;
        reject(reason); // call with this===undefined
        return capability.promise;
      };

      Promise.resolve = function(v) {
        var C = this;
        if (ES.IsPromise(v)) {
          var constructor = v._promiseConstructor;
          if (constructor === C) { return v; }
        }
        var capability = new PromiseCapability(C);
        var resolve = capability.resolve;
        resolve(v); // call with this===undefined
        return capability.promise;
      };

      Promise.prototype['catch'] = function( onRejected ) {
        return this.then(undefined, onRejected);
      };

      Promise.prototype.then = function( onFulfilled, onRejected ) {
        var promise = this;
        if (!ES.IsPromise(promise)) { throw new TypeError('not a promise'); }
        // this.constructor not this._promiseConstructor; see
        // https://bugs.ecmascript.org/show_bug.cgi?id=2513
        var C = this.constructor;
        var capability = new PromiseCapability(C);
        if (!ES.IsCallable(onRejected)) {
          onRejected = function(e) { throw e; };
        }
        if (!ES.IsCallable(onFulfilled)) {
          onFulfilled = function(x) { return x; };
        }
        var resolutionHandler =
          promiseResolutionHandler(promise, onFulfilled, onRejected);
        var resolveReaction =
          { capability: capability, handler: resolutionHandler };
        var rejectReaction =
          { capability: capability, handler: onRejected };
        switch (promise._status) {
        case 'unresolved':
          promise._resolveReactions.push(resolveReaction);
          promise._rejectReactions.push(rejectReaction);
          break;
        case 'has-resolution':
          triggerPromiseReactions([resolveReaction], promise._result);
          break;
        case 'has-rejection':
          triggerPromiseReactions([rejectReaction], promise._result);
          break;
        default:
          throw new TypeError('unexpected');
        }
        return capability.promise;
      };

      return Promise;
    })();
    // export the Promise constructor.
    defineProperties(globals, { Promise: PromiseShim });
    // In Chrome 33 (and thereabouts) Promise is defined, but the
    // implementation is buggy in a number of ways.  Let's check subclassing
    // support to see if we have a buggy implementation.
    var promiseSupportsSubclassing = supportsSubclassing(globals.Promise, function(S) {
      return S.resolve(42) instanceof S;
    });
    var promiseIgnoresNonFunctionThenCallbacks = (function () {
      try {
        globals.Promise.reject(42).then(null, 5).then(null, function () {});
        return true;
      } catch (ex) {
        return false;
      }
    }());
    if (!promiseSupportsSubclassing || !promiseIgnoresNonFunctionThenCallbacks) {
      globals.Promise = PromiseShim;
    }

    // Map and Set require a true ES5 environment
    if (supportsDescriptors) {

      var fastkey = function fastkey(key) {
        var type = typeof key;
        if (type === 'string') {
          return '$' + key;
        } else if (type === 'number') {
          // note that -0 will get coerced to "0" when used as a property key
          return key;
        }
        return null;
      };

      var emptyObject = function emptyObject() {
        // accomodate some older not-quite-ES5 browsers
        return Object.create ? Object.create(null) : {};
      };

      var collectionShims = {
        Map: (function() {

          var empty = {};

          function MapEntry(key, value) {
            this.key = key;
            this.value = value;
            this.next = null;
            this.prev = null;
          }

          MapEntry.prototype.isRemoved = function() {
            return this.key === empty;
          };

          function MapIterator(map, kind) {
            this.head = map._head;
            this.i = this.head;
            this.kind = kind;
          }

          MapIterator.prototype = {
            next: function() {
              var i = this.i, kind = this.kind, head = this.head, result;
              if (this.i === undefined) {
                return { value: undefined, done: true };
              }
              while (i.isRemoved() && i !== head) {
                // back up off of removed entries
                i = i.prev;
              }
              // advance to next unreturned element.
              while (i.next !== head) {
                i = i.next;
                if (!i.isRemoved()) {
                  if (kind === "key") {
                    result = i.key;
                  } else if (kind === "value") {
                    result = i.value;
                  } else {
                    result = [i.key, i.value];
                  }
                  this.i = i;
                  return { value: result, done: false };
                }
              }
              // once the iterator is done, it is done forever.
              this.i = undefined;
              return { value: undefined, done: true };
            }
          };
          addIterator(MapIterator.prototype);

          function Map(iterable) {
            var map = this;
            map = emulateES6construct(map);
            if (!map._es6map) {
              throw new TypeError('bad map');
            }

            var head = new MapEntry(null, null);
            // circular doubly-linked list.
            head.next = head.prev = head;

            defineProperties(map, {
              '_head': head,
              '_storage': emptyObject(),
              '_size': 0
            });

            // Optionally initialize map from iterable
            if (iterable !== undefined && iterable !== null) {
              var it = ES.GetIterator(iterable);
              var adder = map.set;
              if (!ES.IsCallable(adder)) { throw new TypeError('bad map'); }
              while (true) {
                var next = ES.IteratorNext(it);
                if (next.done) { break; }
                var nextItem = next.value;
                if (!ES.TypeIsObject(nextItem)) {
                  throw new TypeError('expected iterable of pairs');
                }
                adder.call(map, nextItem[0], nextItem[1]);
              }
            }
            return map;
          }
          var Map$prototype = Map.prototype;
          defineProperties(Map, {
            '@@create': function(obj) {
              var constructor = this;
              var prototype = constructor.prototype || Map$prototype;
              obj = obj || create(prototype);
              defineProperties(obj, { _es6map: true });
              return obj;
            }
          });

          Object.defineProperty(Map.prototype, 'size', {
            configurable: true,
            enumerable: false,
            get: function() {
              if (typeof this._size === 'undefined') {
                throw new TypeError('size method called on incompatible Map');
              }
              return this._size;
            }
          });

          defineProperties(Map.prototype, {
            get: function(key) {
              var fkey = fastkey(key);
              if (fkey !== null) {
                // fast O(1) path
                var entry = this._storage[fkey];
                return entry ? entry.value : undefined;
              }
              var head = this._head, i = head;
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  return i.value;
                }
              }
              return undefined;
            },

            has: function(key) {
              var fkey = fastkey(key);
              if (fkey !== null) {
                // fast O(1) path
                return typeof this._storage[fkey] !== 'undefined';
              }
              var head = this._head, i = head;
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  return true;
                }
              }
              return false;
            },

            set: function(key, value) {
              var head = this._head, i = head, entry;
              var fkey = fastkey(key);
              if (fkey !== null) {
                // fast O(1) path
                if (typeof this._storage[fkey] !== 'undefined') {
                  this._storage[fkey].value = value;
                  return;
                } else {
                  entry = this._storage[fkey] = new MapEntry(key, value);
                  i = head.prev;
                  // fall through
                }
              }
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  i.value = value;
                  return;
                }
              }
              entry = entry || new MapEntry(key, value);
              if (ES.SameValue(-0, key)) {
                entry.key = +0; // coerce -0 to +0 in entry
              }
              entry.next = this._head;
              entry.prev = this._head.prev;
              entry.prev.next = entry;
              entry.next.prev = entry;
              this._size += 1;
            },

            'delete': function(key) {
              var head = this._head, i = head;
              var fkey = fastkey(key);
              if (fkey !== null) {
                // fast O(1) path
                if (typeof this._storage[fkey] === 'undefined') {
                  return false;
                }
                i = this._storage[fkey].prev;
                delete this._storage[fkey];
                // fall through
              }
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  i.key = i.value = empty;
                  i.prev.next = i.next;
                  i.next.prev = i.prev;
                  this._size -= 1;
                  return true;
                }
              }
              return false;
            },

            clear: function() {
              this._size = 0;
              this._storage = emptyObject();
              var head = this._head, i = head, p = i.next;
              while ((i = p) !== head) {
                i.key = i.value = empty;
                p = i.next;
                i.next = i.prev = head;
              }
              head.next = head.prev = head;
            },

            keys: function() {
              return new MapIterator(this, "key");
            },

            values: function() {
              return new MapIterator(this, "value");
            },

            entries: function() {
              return new MapIterator(this, "key+value");
            },

            forEach: function(callback) {
              var context = arguments.length > 1 ? arguments[1] : null;
              var it = this.entries();
              for (var entry = it.next(); !entry.done; entry = it.next()) {
                callback.call(context, entry.value[1], entry.value[0], this);
              }
            }
          });
          addIterator(Map.prototype, function() { return this.entries(); });

          return Map;
        })(),

        Set: (function() {
          // Creating a Map is expensive.  To speed up the common case of
          // Sets containing only string or numeric keys, we use an object
          // as backing storage and lazily create a full Map only when
          // required.
          var SetShim = function Set(iterable) {
            var set = this;
            set = emulateES6construct(set);
            if (!set._es6set) {
              throw new TypeError('bad set');
            }

            defineProperties(set, {
              '[[SetData]]': null,
              '_storage': emptyObject()
            });

            // Optionally initialize map from iterable
            if (iterable !== undefined && iterable !== null) {
              var it = ES.GetIterator(iterable);
              var adder = set.add;
              if (!ES.IsCallable(adder)) { throw new TypeError('bad set'); }
              while (true) {
                var next = ES.IteratorNext(it);
                if (next.done) { break; }
                var nextItem = next.value;
                adder.call(set, nextItem);
              }
            }
            return set;
          };
          var Set$prototype = SetShim.prototype;
          defineProperties(SetShim, {
            '@@create': function(obj) {
              var constructor = this;
              var prototype = constructor.prototype || Set$prototype;
              obj = obj || create(prototype);
              defineProperties(obj, { _es6set: true });
              return obj;
            }
          });

          // Switch from the object backing storage to a full Map.
          var ensureMap = function ensureMap(set) {
            if (!set['[[SetData]]']) {
              var m = set['[[SetData]]'] = new collectionShims.Map();
              Object.keys(set._storage).forEach(function(k) {
                // fast check for leading '$'
                if (k.charCodeAt(0) === 36) {
                  k = k.slice(1);
                } else {
                  k = +k;
                }
                m.set(k, k);
              });
              set._storage = null; // free old backing storage
            }
          };

          Object.defineProperty(SetShim.prototype, 'size', {
            configurable: true,
            enumerable: false,
            get: function() {
              if (typeof this._storage === 'undefined') {
                // https://github.com/paulmillr/es6-shim/issues/176
                throw new TypeError('size method called on incompatible Set');
              }
              ensureMap(this);
              return this['[[SetData]]'].size;
            }
          });

          defineProperties(SetShim.prototype, {
            has: function(key) {
              var fkey;
              if (this._storage && (fkey = fastkey(key)) !== null) {
                return !!this._storage[fkey];
              }
              ensureMap(this);
              return this['[[SetData]]'].has(key);
            },

            add: function(key) {
              var fkey;
              if (this._storage && (fkey = fastkey(key)) !== null) {
                this._storage[fkey]=true;
                return;
              }
              ensureMap(this);
              return this['[[SetData]]'].set(key, key);
            },

            'delete': function(key) {
              var fkey;
              if (this._storage && (fkey = fastkey(key)) !== null) {
                delete this._storage[fkey];
                return;
              }
              ensureMap(this);
              return this['[[SetData]]']['delete'](key);
            },

            clear: function() {
              if (this._storage) {
                this._storage = emptyObject();
                return;
              }
              return this['[[SetData]]'].clear();
            },

            keys: function() {
              ensureMap(this);
              return this['[[SetData]]'].keys();
            },

            values: function() {
              ensureMap(this);
              return this['[[SetData]]'].values();
            },

            entries: function() {
              ensureMap(this);
              return this['[[SetData]]'].entries();
            },

            forEach: function(callback) {
              var context = arguments.length > 1 ? arguments[1] : null;
              var entireSet = this;
              ensureMap(this);
              this['[[SetData]]'].forEach(function(value, key) {
                callback.call(context, key, key, entireSet);
              });
            }
          });
          addIterator(SetShim.prototype, function() { return this.values(); });

          return SetShim;
        })()
      };
      defineProperties(globals, collectionShims);

      if (globals.Map || globals.Set) {
        /*
          - In Firefox < 23, Map#size is a function.
          - In all current Firefox, Set#entries/keys/values & Map#clear do not exist
          - https://bugzilla.mozilla.org/show_bug.cgi?id=869996
          - In Firefox 24, Map and Set do not implement forEach
          - In Firefox 25 at least, Map and Set are callable without "new"
        */
        if (
          typeof globals.Map.prototype.clear !== 'function' ||
          new globals.Set().size !== 0 ||
          new globals.Map().size !== 0 ||
          typeof globals.Map.prototype.keys !== 'function' ||
          typeof globals.Set.prototype.keys !== 'function' ||
          typeof globals.Map.prototype.forEach !== 'function' ||
          typeof globals.Set.prototype.forEach !== 'function' ||
          isCallableWithoutNew(globals.Map) ||
          isCallableWithoutNew(globals.Set) ||
          !supportsSubclassing(globals.Map, function(M) {
            return (new M([])) instanceof M;
          })
        ) {
          globals.Map = collectionShims.Map;
          globals.Set = collectionShims.Set;
        }
      }
      // Shim incomplete iterator implementations.
      addIterator(Object.getPrototypeOf((new globals.Map()).keys()));
      addIterator(Object.getPrototypeOf((new globals.Set()).keys()));
    }
  };

  if (typeof define === 'function' && define.amd) {
    define(main); // RequireJS
  } else {
    main(); // CommonJS and <script>
  }
})();


}).call(this,require('_process'))
},{"_process":4}],3:[function(require,module,exports){
module.exports = require('./lib');

},{"./lib":1}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"prfun":[function(require,module,exports){
// chain over to `prfun/wrap`, which allows users to specify a non-default
// Promise implementation if they prefer.
require('./wrap')();

},{"./wrap":3}]},{},[])("prfun")
});