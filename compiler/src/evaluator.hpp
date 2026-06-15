#pragma once
/**
 * Bantu Language - Evaluator / Tree-Walking Interpreter
 * High-performance AST evaluator
 */

#include "types.hpp"
#include "ast.hpp"
#include "environment.hpp"
#include "function.hpp"
#include "class.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <functional>

// Helper to create native function values without ambiguity
inline Value makeNative(NativeFn fn) { return Value(std::move(fn)); }

// Signal for control flow breaks
struct BreakSignal {};
struct ContinueSignal {};
struct ReturnSignal { Value value; };

class Evaluator {
public:
    Evaluator() : env_(std::make_shared<Environment>()), globalEnv_(env_) {
        registerBuiltins();
    }

    Value evaluate(std::vector<std::shared_ptr<ASTNode>>& program) {
        Value result;
        for (auto& node : program) {
            result = evalNode(node);
        }
        return result;
    }

private:
    std::shared_ptr<Environment> env_;
    std::shared_ptr<Environment> globalEnv_;

    Value evalNode(std::shared_ptr<ASTNode>& node) {
        if (!node) return Value();

        // Dispatch by dynamic cast
        if (auto n = dynamic_cast<NumberNode*>(node.get()))    return evalNumber(n);
        if (auto n = dynamic_cast<StringNode*>(node.get()))    return evalString(n);
        if (auto n = dynamic_cast<BoolNode*>(node.get()))      return evalBool(n);
        if (auto n = dynamic_cast<NullNode*>(node.get()))      return Value();
        if (auto n = dynamic_cast<ListNode*>(node.get()))      return evalList(n);
        if (auto n = dynamic_cast<DictNode*>(node.get()))      return evalDict(n);
        if (auto n = dynamic_cast<VariableNode*>(node.get()))  return evalVariable(n);
        if (auto n = dynamic_cast<VarDeclNode*>(node.get()))   return evalVarDecl(n);
        if (auto n = dynamic_cast<AssignNode*>(node.get()))    return evalAssign(n);
        if (auto n = dynamic_cast<BinaryOpNode*>(node.get()))  return evalBinaryOp(n);
        if (auto n = dynamic_cast<UnaryOpNode*>(node.get()))   return evalUnaryOp(n);
        if (auto n = dynamic_cast<IfNode*>(node.get()))        return evalIf(n);
        if (auto n = dynamic_cast<WhileNode*>(node.get()))     return evalWhile(n);
        if (auto n = dynamic_cast<ForNode*>(node.get()))       return evalFor(n);
        if (auto n = dynamic_cast<EachNode*>(node.get()))      return evalEach(n);
        if (auto n = dynamic_cast<FuncDeclNode*>(node.get()))  return evalFuncDecl(n);
        if (auto n = dynamic_cast<ReturnNode*>(node.get()))    return evalReturn(n);
        if (auto n = dynamic_cast<CallNode*>(node.get()))      return evalCall(n);
        if (auto n = dynamic_cast<DotAccessNode*>(node.get())) return evalDotAccess(n);
        if (auto n = dynamic_cast<IndexAccessNode*>(node.get())) return evalIndexAccess(n);
        if (auto n = dynamic_cast<TryCatchNode*>(node.get()))  return evalTryCatch(n);
        if (auto n = dynamic_cast<PrintNode*>(node.get()))     return evalPrint(n);

        return Value();
    }

    // ─── Literals ───
    Value evalNumber(NumberNode* n) { return Value(n->value); }
    Value evalString(StringNode* n) { return Value(n->value); }
    Value evalBool(BoolNode* n) { return Value(n->value); }

    Value evalList(ListNode* n) {
        std::vector<Value> elements;
        for (auto& elem : n->elements) elements.push_back(evalNode(elem));
        return Value(std::move(elements));
    }

    Value evalDict(DictNode* n) {
        ObjectMap obj;
        for (auto& [key, valNode] : n->pairs) obj[key] = evalNode(valNode);
        return Value(std::move(obj));
    }

    // ─── Variables ───
    Value evalVariable(VariableNode* n) {
        return env_->get(n->name);
    }

    Value evalVarDecl(VarDeclNode* n) {
        Value val = n->init ? evalNode(n->init) : Value();
        env_->define(n->name, val);
        return val;
    }

    Value evalAssign(AssignNode* n) {
        Value val = evalNode(n->value);
        env_->set(n->name, val);
        return val;
    }

    // ─── Operations ───
    Value evalBinaryOp(BinaryOpNode* n) {
        Value left = evalNode(n->left);
        Value right = evalNode(n->right);

        switch (n->op) {
            case TokenType::PLUS:
                if (left.isNumber() && right.isNumber()) return Value(left.numberVal + right.numberVal);
                if (left.isString() || right.isString()) return Value(left.toString() + right.toString());
                break;
            case TokenType::MINUS:
                if (left.isNumber() && right.isNumber()) return Value(left.numberVal - right.numberVal); break;
            case TokenType::MULTIPLY:
                if (left.isNumber() && right.isNumber()) return Value(left.numberVal * right.numberVal); break;
            case TokenType::DIVIDE:
                if (left.isNumber() && right.isNumber()) {
                    if (right.numberVal == 0) { ErrorHandler::throwRuntimeError("Division by zero"); return Value(); }
                    return Value(left.numberVal / right.numberVal);
                } break;
            case TokenType::MODULO:
                if (left.isNumber() && right.isNumber()) return Value(std::fmod(left.numberVal, right.numberVal)); break;
            case TokenType::EQUALTO:     return Value(left.equals(right));
            case TokenType::NOTEQUALTO:  return Value(!left.equals(right));
            case TokenType::GREATERTHAN: return Value(left.numberVal > right.numberVal);
            case TokenType::LESSTHAN:    return Value(left.numberVal < right.numberVal);
            case TokenType::GREATERTHANEQUAL: return Value(left.numberVal >= right.numberVal);
            case TokenType::LESSTHANEQUAL:    return Value(left.numberVal <= right.numberVal);
            case TokenType::AND: return Value(left.isTruthy() && right.isTruthy());
            case TokenType::OR:  return Value(left.isTruthy() || right.isTruthy());
            default: break;
        }
        return Value();
    }

    Value evalUnaryOp(UnaryOpNode* n) {
        Value operand = evalNode(n->operand);
        if (n->op == TokenType::NOT)    return Value(!operand.isTruthy());
        if (n->op == TokenType::MINUS)  return Value(-operand.numberVal);
        return operand;
    }

    // ─── Control Flow ───
    Value evalIf(IfNode* n) {
        Value cond = evalNode(n->condition);
        if (cond.isTruthy()) {
            return evalBlock(n->body);
        } else if (!n->elseBody.empty()) {
            return evalBlock(n->elseBody);
        }
        return Value();
    }

    Value evalWhile(WhileNode* n) {
        Value result;
        while (evalNode(n->condition).isTruthy()) {
            try { result = evalBlock(n->body); }
            catch (const BreakSignal&) { break; }
            catch (const ContinueSignal&) { continue; }
        }
        return result;
    }

    Value evalFor(ForNode* n) {
        Value result;
        auto prevEnv = env_;
        env_ = std::make_shared<Environment>(env_);
        if (n->init) evalNode(n->init);
        while (evalNode(n->condition).isTruthy()) {
            try { result = evalBlock(n->body); }
            catch (const BreakSignal&) { break; }
            catch (const ContinueSignal&) {}
            if (n->update) evalNode(n->update);
        }
        env_ = prevEnv;
        return result;
    }

    Value evalEach(EachNode* n) {
        Value result;
        auto iterable = evalNode(n->iterable);
        auto prevEnv = env_;
        env_ = std::make_shared<Environment>(env_);

        if (iterable.isList()) {
            for (auto& item : iterable.listVal) {
                env_->define(n->varName, item);
                try { result = evalBlock(n->body); }
                catch (const BreakSignal&) { break; }
                catch (const ContinueSignal&) { continue; }
            }
        } else if (iterable.isObject()) {
            for (auto& [key, val] : iterable.objectVal) {
                env_->define(n->varName, Value(key));
                try { result = evalBlock(n->body); }
                catch (const BreakSignal&) { break; }
                catch (const ContinueSignal&) { continue; }
            }
        }

        env_ = prevEnv;
        return result;
    }

    // ─── Functions ───
    Value evalFuncDecl(FuncDeclNode* n) {
        auto func = std::make_shared<BantuFunction>(n->name, n->params, n->body, env_);
        Value funcVal(func);
        env_->define(n->name, funcVal);
        return funcVal;
    }

    Value evalReturn(ReturnNode* n) {
        Value val = n->value ? evalNode(n->value) : Value();
        throw ReturnSignal{val};
    }

    Value evalCall(CallNode* n) {
        Value callee = evalNode(n->callee);
        std::vector<Value> args;
        for (auto& arg : n->args) args.push_back(evalNode(arg));

        if (callee.isNativeFn()) {
            return callee.nativeFn(std::move(args));
        }

        if (callee.isFunction() && callee.functionVal) {
            auto func = callee.functionVal;
            if (args.size() != func->arity()) {
                ErrorHandler::throwRuntimeError("Function '" + func->name + "' expects " +
                    std::to_string(func->arity()) + " args, got " + std::to_string(args.size()));
            }

            auto prevEnv = env_;
            env_ = std::make_shared<Environment>(func->closure);
            for (size_t i = 0; i < func->params.size(); i++) {
                env_->define(func->params[i], args[i]);
            }

            Value result;
            try { result = evalBlock(func->body); }
            catch (const ReturnSignal& ret) { result = ret.value; }

            env_ = prevEnv;
            return result;
        }

        ErrorHandler::throwRuntimeError("Cannot call non-function value");
        return Value();
    }

    // ─── Property Access ───
    Value evalDotAccess(DotAccessNode* n) {
        Value obj = evalNode(n->object);

        if (obj.isObject()) {
            auto it = obj.objectVal.find(n->property);
            if (it != obj.objectVal.end()) return it->second;
        }
        if (obj.isClassInstance()) {
            return obj.classInstanceVal->getProperty(n->property);
        }
        if (obj.isList()) {
            if (n->property == "length" || n->property == "size") return Value((double)obj.listVal.size());
            if (n->property == "push" || n->property == "add") {
                // Return a native function that pushes to the list
                auto listPtr = &obj.listVal;
                return makeNative([listPtr](std::vector<Value> args) -> Value {
                    for (auto& a : args) listPtr->push_back(a);
                    return Value((double)listPtr->size());
                });
            }
        }
        if (obj.isString()) {
            if (n->property == "length" || n->property == "size") return Value((double)obj.stringVal.size());
        }

        ErrorHandler::throwRuntimeError("Cannot access property '" + n->property + "' on " + obj.toString());
        return Value();
    }

    Value evalIndexAccess(IndexAccessNode* n) {
        Value obj = evalNode(n->object);
        Value idx = evalNode(n->index);

        if (obj.isList() && idx.isNumber()) {
            int i = (int)idx.numberVal;
            if (i >= 0 && i < (int)obj.listVal.size()) return obj.listVal[i];
            ErrorHandler::throwRuntimeError("Index out of bounds: " + std::to_string(i));
        }
        if (obj.isObject() && idx.isString()) {
            auto it = obj.objectVal.find(idx.stringVal);
            if (it != obj.objectVal.end()) return it->second;
        }
        if (obj.isString() && idx.isNumber()) {
            int i = (int)idx.numberVal;
            if (i >= 0 && i < (int)obj.stringVal.size()) return Value(std::string(1, obj.stringVal[i]));
        }

        return Value();
    }

    // ─── Try-Catch ───
    Value evalTryCatch(TryCatchNode* n) {
        try {
            return evalBlock(n->tryBody);
        } catch (const std::exception& e) {
            auto prevEnv = env_;
            env_ = std::make_shared<Environment>(env_);
            env_->define(n->catchVar, Value(std::string(e.what())));
            Value result = evalBlock(n->catchBody);
            env_ = prevEnv;
            return result;
        } catch (...) {
            auto prevEnv = env_;
            env_ = std::make_shared<Environment>(env_);
            env_->define(n->catchVar, Value("Unknown error"));
            Value result = evalBlock(n->catchBody);
            env_ = prevEnv;
            return result;
        }
    }

    // ─── Print ───
    Value evalPrint(PrintNode* n) {
        Value val = evalNode(n->value);
        std::cout << val.toString() << "\n";
        globalLog.add(val);
        return val;
    }

    // ─── Helpers ───
    Value evalBlock(std::vector<std::shared_ptr<ASTNode>>& statements) {
        Value result;
        for (auto& stmt : statements) {
            result = evalNode(stmt);
        }
        return result;
    }

    // ─── Built-in Functions ───
    void registerBuiltins() {
        // print as a function too
        env_->define("print", makeNative([](std::vector<Value> args) -> Value {
            for (auto& a : args) std::cout << a.toString() << " ";
            std::cout << "\n";
            return Value();
        }));

        // len
        env_->define("len", makeNative([](std::vector<Value> args) -> Value {
            if (args.empty()) return Value(0.0);
            auto& a = args[0];
            if (a.isString()) return Value((double)a.stringVal.size());
            if (a.isList())   return Value((double)a.listVal.size());
            if (a.isObject()) return Value((double)a.objectVal.size());
            return Value(0.0);
        }));

        // type
        env_->define("type", makeNative([](std::vector<Value> args) -> Value {
            if (args.empty()) return Value("null");
            switch (args[0].type) {
                case Value::NUMBER: return Value("number");
                case Value::STRING: return Value("string");
                case Value::BOOL:   return Value("bool");
                case Value::NULL_VAL: return Value("null");
                case Value::FUNCTION: case Value::NATIVE_FN: return Value("func");
                case Value::LIST:   return Value("list");
                case Value::OBJECT: return Value("dict");
                case Value::CLASS_INSTANCE: return Value("class instance");
                case Value::CLASS_DEF: return Value("class");
            }
            return Value("unknown");
        }));

        // sleep (ms)
        env_->define("sleep", makeNative([](std::vector<Value> args) -> Value {
            if (!args.empty() && args[0].isNumber()) {
                std::this_thread::sleep_for(std::chrono::milliseconds((int)args[0].numberVal));
            }
            return Value();
        }));

        // abs, floor, ceil, sqrt, pow
        env_->define("abs", makeNative([](std::vector<Value> args) -> Value {
            return args.empty() ? Value(0.0) : Value(std::abs(args[0].numberVal));
        }));
        env_->define("floor", makeNative([](std::vector<Value> args) -> Value {
            return args.empty() ? Value(0.0) : Value(std::floor(args[0].numberVal));
        }));
        env_->define("ceil", makeNative([](std::vector<Value> args) -> Value {
            return args.empty() ? Value(0.0) : Value(std::ceil(args[0].numberVal));
        }));
        env_->define("sqrt", makeNative([](std::vector<Value> args) -> Value {
            return args.empty() ? Value(0.0) : Value(std::sqrt(args[0].numberVal));
        }));
        env_->define("pow", makeNative([](std::vector<Value> args) -> Value {
            if (args.size() >= 2) return Value(std::pow(args[0].numberVal, args[1].numberVal));
            return Value(0.0);
        }));

        // str, num, bool conversions
        env_->define("str", makeNative([](std::vector<Value> args) -> Value {
            return args.empty() ? Value("") : Value(args[0].toString());
        }));
        env_->define("num", makeNative([](std::vector<Value> args) -> Value {
            if (args.empty()) return Value(0.0);
            if (args[0].isString()) try { return Value(std::stod(args[0].stringVal)); } catch(...) { return Value(0.0); }
            if (args[0].isNumber()) return args[0];
            return Value(0.0);
        }));

        // push, pop for lists
        env_->define("push", makeNative([](std::vector<Value> args) -> Value {
            // This is a simplified version
            return args.empty() ? Value() : args[0];
        }));

        // range
        env_->define("range", makeNative([](std::vector<Value> args) -> Value {
            int start = 0, end = 0;
            if (args.size() == 1) { end = (int)args[0].numberVal; }
            else if (args.size() >= 2) { start = (int)args[0].numberVal; end = (int)args[1].numberVal; }
            std::vector<Value> list;
            for (int i = start; i < end; i++) list.push_back(Value((double)i));
            return Value(std::move(list));
        }));

        // clock
        env_->define("clock", makeNative([](std::vector<Value> args) -> Value {
            auto now = std::chrono::high_resolution_clock::now();
            auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch());
            return Value((double)ms.count());
        }));

        // max, min
        env_->define("max", makeNative([](std::vector<Value> args) -> Value {
            if (args.size() < 2) return args.empty() ? Value() : args[0];
            return Value(std::max(args[0].numberVal, args[1].numberVal));
        }));
        env_->define("min", makeNative([](std::vector<Value> args) -> Value {
            if (args.size() < 2) return args.empty() ? Value() : args[0];
            return Value(std::min(args[0].numberVal, args[1].numberVal));
        }));
    }
};
