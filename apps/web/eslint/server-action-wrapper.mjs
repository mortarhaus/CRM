import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_GLOBALS,
  ALLOWED_IMPORTS,
  AUTH_CALL,
  BANNED_NAMES,
  CALLBACK_METHODS,
  CHAIN_FUNCTIONS,
  CHAIN_METHODS,
  FORWARDING_ACTIONS,
  RECEIVER_METHODS,
  SESSION_CALL,
} from "./forwarding-actions.mjs";

// AUTH-01 (plan Task 15): every function Next.js exposes because of a "use server" directive goes through action(),
// or is a forwarder named in forwarding-actions.mjs whose body keeps the forwarding-only shape F1 to F9. The rule
// follows the directive, not the file name: every export of a module whose prologue has "use server", and every
// function whose body starts with it.

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ACTION_MODULE = "@/lib/auth/action";
const LOOPS = new Set(["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "LabeledStatement"]);
const FUNCTION_VALUED_GLOBALS = new Set(["String", "Array", "URL", "Set"]);
const TYPE_KEYS = new Set(["typeAnnotation", "returnType", "typeParameters", "typeArguments"]);

function hasUseServer(statements) {
  for (const statement of statements) {
    if (statement.type !== "ExpressionStatement" || typeof statement.directive !== "string") return false;
    if (statement.directive === "use server") return true;
  }
  return false;
}

const unwrapAsConst = (node) =>
  node?.type === "TSAsExpression" && node.typeAnnotation.type === "TSTypeReference" && node.typeAnnotation.typeName.name === "const"
    ? node.expression
    : node;

export const serverActionWrapper = {
  meta: {
    type: "problem",
    docs: { description: "Every server action goes through action() or is a named Better Auth forwarder (AUTH-01)" },
    schema: [],
    messages: {
      wrapper: "Server actions go through action() (AUTH-01)",
      forwarderShape: "Forwarder {{name}} does more than forward to Better Auth (AUTH-01): {{rule}}",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const file = path.relative(REPO_ROOT, context.filename).split(path.sep).join("/");
    const listedNames = FORWARDING_ACTIONS[file] ?? [];
    const scopeManager = sourceCode.scopeManager;
    const moduleScope = scopeManager.globalScope.childScopes.find((scope) => scope.type === "module") ?? scopeManager.globalScope;
    const forwarderNodes = new Set();

    const referenceOf = new Map();
    for (const scope of scopeManager.scopes) for (const reference of scope.references) referenceOf.set(reference.identifier, reference);

    const reported = new Set();
    const shape = (node, name, rule) => {
      const key = `${node.range[0]}:${node.range[1]}:${rule}`;
      if (reported.has(key)) return;
      reported.add(key);
      context.report({ node, messageId: "forwarderShape", data: { name, rule } });
    };
    const wrapper = (node) => context.report({ node, messageId: "wrapper" });

    // What a variable is, from its one definition: an import (with its F1 class), a helper, an exported function, a
    // parameter, a const (with the kind of its initializer), a global, or anything else.
    const infoCache = new Map();
    function info(variable) {
      if (!variable || (variable.scope.type === "global" && variable.defs.length === 0)) return { kind: "global" };
      if (infoCache.has(variable)) return infoCache.get(variable);
      infoCache.set(variable, { kind: "other" });
      const result = describe(variable);
      infoCache.set(variable, result);
      return result;
    }

    function describe(variable) {
      if (variable.defs.length !== 1) return { kind: "other" };
      const [def] = variable.defs;
      if (def.type === "ImportBinding") return importInfo(def);
      if (def.type === "FunctionName") {
        if (def.node.parent.type === "Program") return { kind: "helper", node: def.node };
        if (def.node.parent.type === "ExportNamedDeclaration") return { kind: "exported", node: def.node };
        return { kind: "other" };
      }
      if (def.type === "Parameter") return { kind: "parameter", fn: def.node };
      if (def.type === "Variable" && def.node.id === def.name) {
        if (def.parent.kind !== "const") return { kind: "mutable" };
        return { kind: "const", init: initKind(def.node.init) };
      }
      return { kind: "other" };
    }

    function importInfo(def) {
      const module = def.parent.source.value;
      const allowed = ALLOWED_IMPORTS[module];
      if (def.node.type !== "ImportSpecifier") return { kind: "import", module, imported: null, cls: "disallowed" };
      const imported = def.node.imported.type === "Identifier" ? def.node.imported.name : def.node.imported.value;
      const typeOnly = def.node.importKind === "type" || def.parent.importKind === "type";
      let cls = "disallowed";
      if (allowed && typeOnly && allowed.types?.includes(imported)) cls = "type";
      else if (allowed && !typeOnly && allowed.functions?.includes(imported)) cls = "function";
      else if (allowed && !typeOnly && allowed.values instanceof RegExp && allowed.values.test(imported)) cls = "value";
      else if (allowed && !typeOnly && Array.isArray(allowed.values) && allowed.values.includes(imported)) cls = "value";
      return { kind: "import", module, imported, cls };
    }

    const resolve = (identifier) => info(referenceOf.get(identifier)?.resolved ?? null);
    const isGlobalNamed = (node, name) => node?.type === "Identifier" && node.name === name && resolve(node).kind === "global";
    const isImportCall = (node, target) => {
      if (node?.type !== "CallExpression" || node.optional || node.callee.type !== "Identifier") return false;
      const callee = resolve(node.callee);
      return callee.kind === "import" && callee.module === target.module && callee.imported === target.name;
    };
    const isFunctionImport = (node, name) => {
      if (node?.type !== "Identifier") return false;
      const resolved = resolve(node);
      return resolved.kind === "import" && resolved.cls === "function" && resolved.imported === name;
    };

    function isLiteralOnly(node, { set = true } = {}) {
      const value = unwrapAsConst(node);
      if (!value) return false;
      if (value.type === "Literal") return true;
      if (value.type === "TemplateLiteral") return value.expressions.length === 0;
      if (value.type === "ArrayExpression") return value.elements.every((element) => element !== null && isLiteralOnly(element, { set: false }));
      if (set && value.type === "NewExpression") return isLiteralSet(value);
      return false;
    }

    function isLiteralSet(node) {
      if (node.type !== "NewExpression" || !isGlobalNamed(node.callee, "Set") || node.arguments.length !== 1) return false;
      const [array] = node.arguments;
      return (
        array.type === "ArrayExpression" &&
        array.elements.every((element) => element?.type === "Literal" && (typeof element.value === "string" || typeof element.value === "number"))
      );
    }

    const plainArguments = (call) =>
      call.arguments.every((argument) => argument.type === "Literal" || (argument.type === "Identifier" && resolve(argument).kind === "parameter"));

    function isFormRead(node) {
      if (node?.type !== "CallExpression" || node.optional) return false;
      const { callee } = node;
      if (callee.type === "Identifier") return isFunctionImport(callee, "textField") && plainArguments(node);
      if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return false;
      const method = callee.property.name;
      if ((method === "get" || method === "getAll") && callee.object.type === "Identifier" && resolve(callee.object).kind === "parameter") {
        return plainArguments(node);
      }
      return RECEIVER_METHODS.form.includes(method) && isFormRead(callee.object);
    }

    function memberRoot(node) {
      let current = node;
      while (current.type === "MemberExpression") current = current.object;
      return current;
    }

    function isAuthResult(node) {
      if (node?.type === "AwaitExpression") return isImportCall(node.argument, AUTH_CALL);
      if (node?.type !== "MemberExpression") return false;
      const root = memberRoot(node);
      if (root.type !== "Identifier") return false;
      const resolved = resolve(root);
      return resolved.kind === "const" && resolved.init === "auth";
    }

    function initKind(init) {
      const value = unwrapAsConst(init);
      if (value?.type === "Literal" && value.regex) return "regex";
      if (value && isLiteralSet(value)) return "set";
      if (isLiteralOnly(value)) return "literal";
      if (isFormRead(value)) return "form";
      if (isAuthResult(value)) return "auth";
      return "other";
    }

    // The result of an allowed call or new in the same chain: textField(…), randomUUID(), String(…), an allowed
    // method's result, or new URL(x).searchParams.
    function isChainResult(node) {
      if (node.type === "CallExpression" && !node.optional) {
        if (node.callee.type === "Identifier") {
          const name = node.callee.name;
          if (!CHAIN_FUNCTIONS.includes(name)) return false;
          return name === "String" ? isGlobalNamed(node.callee, "String") : isFunctionImport(node.callee, name);
        }
        return (
          node.callee.type === "MemberExpression" &&
          !node.callee.computed &&
          node.callee.property.type === "Identifier" &&
          CHAIN_METHODS.includes(node.callee.property.name)
        );
      }
      return (
        node.type === "MemberExpression" &&
        !node.computed &&
        node.property.type === "Identifier" &&
        node.property.name === "searchParams" &&
        node.object.type === "NewExpression" &&
        isGlobalNamed(node.object.callee, "URL")
      );
    }

    function containsIsArrayOf(tree, member) {
      const text = sourceCode.getText(member);
      let found = false;
      walkTree(tree, (node) => {
        if (
          node.type === "CallExpression" &&
          node.callee.type === "MemberExpression" &&
          isGlobalNamed(node.callee.object, "Array") &&
          !node.callee.computed &&
          node.callee.property.name === "isArray" &&
          node.arguments.length === 1 &&
          sourceCode.getText(node.arguments[0]) === text
        ) {
          found = true;
        }
      });
      return found;
    }

    function guardedByIsArray(call, receiver) {
      for (let node = call; node.parent; node = node.parent) {
        const parent = node.parent;
        if (parent.type === "ConditionalExpression" && parent.consequent === node && containsIsArrayOf(parent.test, receiver)) return true;
        if (parent.type === "LogicalExpression" && parent.operator === "&&" && parent.right === node && containsIsArrayOf(parent.left, receiver)) return true;
        if (parent.type === "IfStatement" && parent.consequent === node && containsIsArrayOf(parent.test, receiver)) return true;
      }
      return false;
    }

    function walkTree(node, visit) {
      if (!node || typeof node.type !== "string") return;
      visit(node);
      for (const key of sourceCode.visitorKeys[node.type] ?? []) {
        if (TYPE_KEYS.has(key)) continue;
        const child = node[key];
        if (Array.isArray(child)) for (const item of child) walkTree(item, visit);
        else walkTree(child, visit);
      }
    }

    // F7, property (a): a function value appears only as the callee of a call, as the object of Array.isArray or
    // URL.canParse, or (String) as the single argument of map.
    function allowedFunctionPosition(identifier, resolved) {
      const parent = identifier.parent;
      if ((parent.type === "CallExpression" || parent.type === "NewExpression") && parent.callee === identifier) return true;
      if (resolved.kind !== "global") return false;
      if (
        parent.type === "MemberExpression" &&
        parent.object === identifier &&
        !parent.computed &&
        parent.parent.type === "CallExpression" &&
        parent.parent.callee === parent &&
        ((identifier.name === "Array" && parent.property.name === "isArray") || (identifier.name === "URL" && parent.property.name === "canParse"))
      ) {
        return true;
      }
      return (
        identifier.name === "String" &&
        parent.type === "CallExpression" &&
        parent.arguments.length === 1 &&
        parent.arguments[0] === identifier &&
        parent.callee.type === "MemberExpression" &&
        !parent.callee.computed &&
        parent.callee.property.name === "map"
      );
    }

    const isFunctionValued = (identifier, resolved) =>
      (resolved.kind === "import" && resolved.cls === "function") ||
      resolved.kind === "helper" ||
      resolved.kind === "exported" ||
      (resolved.kind === "global" && FUNCTION_VALUED_GLOBALS.has(identifier.name));

    function isAllowedCallback(node) {
      const call = node.parent;
      return (
        node.type === "ArrowFunctionExpression" &&
        !node.async &&
        node.body.type !== "BlockStatement" &&
        call?.type === "CallExpression" &&
        call.arguments.length === 1 &&
        call.arguments[0] === node &&
        call.callee.type === "MemberExpression" &&
        !call.callee.computed &&
        call.callee.property.type === "Identifier" &&
        CALLBACK_METHODS.includes(call.callee.property.name)
      );
    }

    // F4 and F4b: the callee of every call and new in checked code, from a closed list.
    function checkCall(node, ctx) {
      const { callee } = node;
      if (node.type === "NewExpression") {
        if (isGlobalNamed(callee, "URL") && node.arguments.length === 1) return;
        const moduleInit = node.parent.type === "VariableDeclarator" && node.parent.init === node && node.parent.parent.parent.type === "Program";
        if (moduleInit && isLiteralSet(node)) return;
        shape(node, ctx.name, "F4: new of anything but URL(x), or Set([<literals>]) as a module const");
        return;
      }
      if (callee.type === "Identifier") {
        const resolved = resolve(callee);
        if (resolved.kind === "import" && resolved.cls === "function") return;
        if (resolved.kind === "helper") return;
        if (resolved.kind === "global" && callee.name === "String" && node.arguments.length === 1) return;
        shape(callee, ctx.name, `F4: ${callee.name} is not a function import or a helper`);
        return;
      }
      if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") {
        const method = callee.property.name;
        if (method === "call" || method === "apply" || method === "bind") {
          shape(callee, ctx.name, `F4: .${method}`);
          return;
        }
        if (isGlobalNamed(callee.object, "Array") && method === "isArray" && node.arguments.length === 1) return;
        if (isGlobalNamed(callee.object, "URL") && method === "canParse" && node.arguments.length === 1) return;
        checkReceiver(node, callee.object, method, ctx);
        return;
      }
      shape(callee, ctx.name, `F4: callee shape ${callee.type}${callee.computed ? " (computed member)" : ""}`);
    }

    function receiverMethods(receiver, call) {
      if (receiver.type === "Identifier") {
        const resolved = resolve(receiver);
        if (resolved.kind === "parameter") return ctxFunctions.has(resolved.fn) ? RECEIVER_METHODS.parameter : null;
        if (resolved.kind !== "const") return null;
        if (resolved.init === "regex") return RECEIVER_METHODS.regex;
        if (resolved.init === "set") return RECEIVER_METHODS.set;
        if (resolved.init === "form") return RECEIVER_METHODS.form;
        if (resolved.init === "auth") return guardedByIsArray(call, receiver) ? RECEIVER_METHODS.auth : [];
        return null;
      }
      if (isChainResult(receiver)) return RECEIVER_METHODS.chain;
      if (receiver.type === "MemberExpression" && isAuthResult(receiver)) {
        return guardedByIsArray(call, receiver) ? RECEIVER_METHODS.auth : [];
      }
      return null;
    }

    function checkReceiver(call, receiver, method, ctx) {
      const methods = receiverMethods(receiver, call);
      if (methods === null) shape(call.callee, ctx.name, `F4b: ${sourceCode.getText(receiver)} is not an allowed receiver`);
      else if (!methods.includes(method)) shape(call.callee, ctx.name, `F4b: .${method} is not allowed on ${sourceCode.getText(receiver)}`);
    }

    function writeTargetIsOutside(target) {
      const root = target.type === "MemberExpression" ? memberRoot(target) : target;
      if (root.type !== "Identifier") return true;
      const variable = referenceOf.get(root)?.resolved ?? null;
      return !variable || variable.scope.type === "module" || variable.scope.type === "global";
    }

    // The F-rules checked on one node of checked code; walk() calls it for every node.
    function checkNode(node, ctx) {
      switch (node.type) {
        case "ImportExpression":
          shape(node, ctx.name, "F1: import()");
          break;
        case "AwaitExpression":
          if (ctx.kind !== "listed") shape(node, ctx.name, "F3: await outside the listed function");
          else if (!isImportCall(node.argument, AUTH_CALL) && !isImportCall(node.argument, SESSION_CALL)) {
            shape(node, ctx.name, "F3: await of something other than postToAuth or getCurrentSession");
          }
          break;
        case "CallExpression":
          if (node.callee.type === "Identifier" && isFunctionImport(node.callee, AUTH_CALL.name)) ctx.authCalls.push({ node, kind: ctx.kind });
          checkCall(node, ctx);
          break;
        case "NewExpression":
          checkCall(node, ctx);
          break;
        case "TaggedTemplateExpression":
        case "JSXElement":
        case "JSXFragment":
          shape(node, ctx.name, `F4: ${node.type}`);
          break;
        case "ThisExpression":
        case "MetaProperty":
        case "Super":
          shape(node, ctx.name, `F5: ${node.type}`);
          break;
        case "AssignmentExpression":
          if (writeTargetIsOutside(node.left)) shape(node, ctx.name, "F6: a write outside the function");
          break;
        case "UpdateExpression":
          if (writeTargetIsOutside(node.argument)) shape(node, ctx.name, "F6: a write outside the function");
          break;
        case "UnaryExpression":
          if (node.operator === "delete") shape(node, ctx.name, "F6: delete");
          break;
        case "VariableDeclaration":
          if (node.kind !== "const") shape(node, ctx.name, `F6: ${node.kind} (only const)`);
          break;
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ClassDeclaration":
        case "ClassExpression":
        case "YieldExpression":
          shape(node, ctx.name, `F8: ${node.type}`);
          break;
        case "ArrowFunctionExpression":
          if (!isAllowedCallback(node)) shape(node, ctx.name, "F8: a function value other than an inline filter or map callback");
          break;
        case "ObjectExpression":
          for (const property of node.properties) {
            if (property.type !== "Property") continue;
            if (property.kind !== "init" || property.method || property.computed) {
              shape(property, ctx.name, "F8: an object method, getter, setter or computed key");
            }
            const value = property.value;
            if (/Function|Class/.test(value.type)) shape(property, ctx.name, "F8: an object property holding a function");
            if (value.type === "Identifier" && isFunctionValued(value, resolve(value))) {
              shape(property, ctx.name, "F8: an object property holding a function");
            }
          }
          break;
        case "Identifier":
          checkIdentifier(node, ctx);
          break;
        default:
          if (LOOPS.has(node.type)) shape(node, ctx.name, `F9: ${node.type}`);
      }
    }

    function checkIdentifier(node, ctx) {
      const reference = referenceOf.get(node);
      if (!reference || reference.isTypeReference) return;
      const resolved = info(reference.resolved);
      if (BANNED_NAMES.includes(node.name)) shape(node, ctx.name, `F5: ${node.name}`);
      if (resolved.kind === "global" && !ALLOWED_GLOBALS.includes(node.name)) shape(node, ctx.name, `F5: global ${node.name}`);
      if (isFunctionValued(node, resolved) && !allowedFunctionPosition(node, resolved)) {
        shape(node, ctx.name, `F7: ${node.name} used as a value`);
      }
      if (resolved.kind === "exported") shape(node, ctx.name, `F7: reference to the export ${node.name}`);
      if (ctx.kind === "helper" && resolved.kind === "helper" && resolved.node === ctx.fn) shape(node, ctx.name, "F7: recursion");
    }

    // Walks checked code. A callback allowed by F8 is walked as a callback; every other nested function is reported
    // by checkNode and walked with the same rules.
    function walk(node, ctx) {
      if (!node || typeof node.type !== "string") return;
      checkNode(node, ctx);
      const inner = isAllowedCallback(node) ? { ...ctx, kind: "callback" } : ctx;
      for (const key of sourceCode.visitorKeys[node.type] ?? []) {
        if (TYPE_KEYS.has(key)) continue;
        const child = node[key];
        if (Array.isArray(child)) for (const item of child) walk(item, inner);
        else walk(child, inner);
      }
    }

    // Functions whose parameters are allowed receivers: the listed functions and the helpers.
    const ctxFunctions = new Set();

    function checkForwarderFile(program, forwarders) {
      const allNames = listedNames.join(", ");
      const helpers = program.body.filter((statement) => statement.type === "FunctionDeclaration");
      for (const fn of [...forwarders, ...helpers]) ctxFunctions.add(fn);

      // F1, once per file: imports and exports.
      for (const statement of program.body) {
        if (statement.type === "ImportDeclaration") {
          if (!ALLOWED_IMPORTS[statement.source.value]) {
            shape(statement, allNames, `F1: import of ${statement.source.value}`);
            continue;
          }
          if (statement.specifiers.length === 0) shape(statement, allNames, `F1: side-effect import of ${statement.source.value}`);
          for (const specifier of statement.specifiers) {
            const variable = sourceCode.scopeManager.getDeclaredVariables(specifier)[0];
            const imported = info(variable);
            if (specifier.type !== "ImportSpecifier") shape(specifier, allNames, "F1: default or namespace import");
            else if (imported.cls === "disallowed") shape(specifier, allNames, `F1: ${imported.imported} from ${imported.module}`);
          }
        }
        if (statement.type === "ExportAllDeclaration" || (statement.type === "ExportNamedDeclaration" && statement.source)) {
          shape(statement, allNames, "F1: re-export");
        }
        if (statement.type === "ExportNamedDeclaration" && !statement.source) {
          for (const specifier of statement.specifiers) {
            const resolved = resolve(specifier.local);
            if ((resolved.kind === "import" && resolved.cls !== "type") || resolved.kind === "helper") {
              shape(specifier, allNames, `F1: export of ${specifier.local.name}`);
            }
          }
        }
        if (statement.type === "ExportDefaultDeclaration") shape(statement, allNames, "F1: export default");
      }

      // Which listed functions reach each helper, so a helper's report names them.
      const reachedBy = new Map(helpers.map((helper) => [helper, new Set()]));
      const helperEdges = new Map();
      for (const fn of [...forwarders, ...helpers]) {
        const calls = new Set();
        walkTree(fn.body, (node) => {
          if (node.type === "CallExpression" && node.callee.type === "Identifier") {
            const resolved = resolve(node.callee);
            if (resolved.kind === "helper") calls.add(resolved.node);
          }
        });
        helperEdges.set(fn, calls);
      }
      for (const fn of forwarders) {
        const queue = [...helperEdges.get(fn)];
        const seen = new Set();
        while (queue.length > 0) {
          const helper = queue.shift();
          if (seen.has(helper)) continue;
          seen.add(helper);
          reachedBy.get(helper)?.add(fn.id.name);
          queue.push(...(helperEdges.get(helper) ?? []));
        }
      }

      for (const fn of forwarders) {
        const ctx = { kind: "listed", name: fn.id.name, fn, authCalls: [] };
        if (fn.generator) shape(fn, ctx.name, "F8: generator");
        for (const param of fn.params) walk(param, ctx);
        walk(fn.body, ctx);
        // F2: exactly one postToAuth call, in the function's own body, awaited directly, not optional.
        const own = ctx.authCalls.filter((call) => call.kind === "listed");
        for (const call of ctx.authCalls) if (call.kind !== "listed") shape(call.node, ctx.name, "F2: postToAuth in a callback");
        if (own.length !== 1) shape(fn.id, ctx.name, `F2: ${own.length} postToAuth calls (exactly one)`);
        for (const { node } of own) {
          if (node.parent.type !== "AwaitExpression" || node.parent.argument !== node) shape(node, ctx.name, "F2: postToAuth not awaited directly");
        }
      }

      for (const helper of helpers) {
        const reached = [...(reachedBy.get(helper) ?? [])];
        const name = `${reached.length > 0 ? reached.join(", ") : allNames} (helper ${helper.id.name})`;
        const ctx = { kind: "helper", name, fn: helper, authCalls: [] };
        if (helper.async) shape(helper, name, "F3: async helper");
        if (helper.generator) shape(helper, name, "F8: generator");
        for (const param of helper.params) walk(param, ctx);
        walk(helper.body, ctx);
        for (const call of ctx.authCalls) shape(call.node, name, "F2: postToAuth in a helper");
      }

      // F7: the helper call graph is acyclic, so the one postToAuth call runs at most once.
      const visiting = new Set();
      const done = new Set();
      const visit = (helper) => {
        if (done.has(helper)) return;
        if (visiting.has(helper)) {
          shape(helper.id, allNames, `F7: recursion through ${helper.id.name}`);
          return;
        }
        visiting.add(helper);
        for (const next of helperEdges.get(helper) ?? []) visit(next);
        visiting.delete(helper);
        done.add(helper);
      };
      for (const helper of helpers) visit(helper);

      // Module-level statements other than imports, helpers, exports and types.
      for (const statement of program.body) {
        const ctx = { kind: "module", name: allNames, fn: null, authCalls: [] };
        if (statement.type === "VariableDeclaration") {
          walk(statement, ctx);
          for (const declarator of statement.declarations) {
            if (!allowedModuleInit(declarator.init)) shape(declarator, allNames, "F8: a module const that is not plain data");
          }
          for (const call of ctx.authCalls) shape(call.node, allNames, "F2: postToAuth at module level");
          continue;
        }
        if (
          statement.type === "ImportDeclaration" ||
          statement.type === "FunctionDeclaration" ||
          statement.type === "ExportNamedDeclaration" ||
          statement.type === "ExportAllDeclaration" ||
          statement.type === "ExportDefaultDeclaration" ||
          statement.type === "TSInterfaceDeclaration" ||
          statement.type === "TSTypeAliasDeclaration" ||
          (statement.type === "ExpressionStatement" && typeof statement.directive === "string")
        ) {
          continue;
        }
        shape(statement, allNames, `F8: module-level ${statement.type}`);
        walk(statement, ctx);
      }
    }

    // F8: a module const is literal-only, an object of literals, value imports and such objects, or a Set of literals.
    function allowedModuleInit(init) {
      const value = unwrapAsConst(init);
      if (!value) return false;
      if (isLiteralOnly(value)) return true;
      if (value.type === "Identifier") {
        const resolved = resolve(value);
        return resolved.kind === "import" && resolved.cls === "value";
      }
      if (value.type !== "ObjectExpression") return false;
      return value.properties.every(
        (property) =>
          property.type === "Property" && property.kind === "init" && !property.method && !property.computed && allowedModuleInit(property.value),
      );
    }

    function isActionCall(init) {
      if (init?.type !== "CallExpression" || init.optional || init.callee.type !== "Identifier") return false;
      const callee = resolve(init.callee);
      return callee.kind === "import" && callee.module === ACTION_MODULE && callee.imported === "action";
    }

    function isActionBinding(variable) {
      if (!variable || variable.defs.length !== 1) return false;
      const [def] = variable.defs;
      return def.type === "Variable" && def.parent.kind === "const" && def.node.id === def.name && isActionCall(def.node.init);
    }

    const isTypeOnly = (variable) => variable !== undefined && variable.defs.length > 0 && variable.defs.every((def) => def.type === "Type");

    // Every export of a "use server" module is action(…) or a listed forwarder; anything else reports.
    function checkExports(program) {
      const forwarders = [];
      for (const statement of program.body) {
        if (statement.type === "ExportNamedDeclaration") {
          if (statement.exportKind === "type") continue;
          if (statement.source) {
            wrapper(statement);
            continue;
          }
          const declaration = statement.declaration;
          if (declaration) {
            if (declaration.type === "TSInterfaceDeclaration" || declaration.type === "TSTypeAliasDeclaration" || declaration.declare) continue;
            if (declaration.type === "FunctionDeclaration" && declaration.id && listedNames.includes(declaration.id.name)) {
              forwarders.push(declaration);
              forwarderNodes.add(declaration);
            } else if (declaration.type === "VariableDeclaration") {
              for (const declarator of declaration.declarations) {
                if (!(declaration.kind === "const" && declarator.id.type === "Identifier" && isActionCall(declarator.init))) wrapper(declarator);
              }
            } else {
              wrapper(declaration.id ?? declaration);
            }
            continue;
          }
          for (const specifier of statement.specifiers) {
            if (specifier.exportKind === "type") continue;
            const variable = moduleScope.set.get(specifier.local.name);
            if (!isTypeOnly(variable) && !isActionBinding(variable)) wrapper(specifier);
          }
        } else if (statement.type === "ExportDefaultDeclaration" || statement.type === "TSExportAssignment") {
          wrapper(statement);
        } else if (statement.type === "ExportAllDeclaration" && statement.exportKind !== "type") {
          wrapper(statement);
        }
      }
      return forwarders;
    }

    function inlineAction(node) {
      if (node.body.type === "BlockStatement" && hasUseServer(node.body.body) && !forwarderNodes.has(node)) wrapper(node);
    }

    return {
      Program(program) {
        if (!hasUseServer(program.body)) return;
        const forwarders = checkExports(program);
        if (listedNames.length > 0) checkForwarderFile(program, forwarders);
      },
      FunctionDeclaration: inlineAction,
      FunctionExpression: inlineAction,
      ArrowFunctionExpression: inlineAction,
    };
  },
};
