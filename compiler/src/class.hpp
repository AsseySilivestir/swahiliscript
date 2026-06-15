#pragma once
/**
 * Bantu Language - Class System
 */

#include "types.hpp"
#include "environment.hpp"
#include <unordered_map>
#include <string>

class ClassDefinition {
public:
    std::string name;
    std::unordered_map<std::string, Value> methods;
    ClassDefinition* parentClass = nullptr;

    ClassDefinition(const std::string& n) : name(n) {}

    void addMethod(const std::string& methodName, const Value& method) {
        methods[methodName] = method;
    }

    Value getMethod(const std::string& methodName) {
        auto it = methods.find(methodName);
        if (it != methods.end()) return it->second;
        if (parentClass) return parentClass->getMethod(methodName);
        return Value();
    }
};

class ClassInstance {
public:
    ClassDefinition* classDef;
    std::unordered_map<std::string, Value> properties;

    ClassInstance(ClassDefinition* cd) : classDef(cd) {}

    Value getProperty(const std::string& propName) {
        auto it = properties.find(propName);
        if (it != properties.end()) return it->second;
        return classDef->getMethod(propName);
    }

    void setProperty(const std::string& propName, const Value& val) {
        properties[propName] = val;
    }
};
