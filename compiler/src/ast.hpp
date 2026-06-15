#pragma once
/**
 * Bantu Language - Abstract Syntax Tree Nodes
 */

#include "types.hpp"
#include <vector>
#include <memory>

struct ASTNode {
    int line;
    int col;
    virtual ~ASTNode() = default;
    ASTNode(int l = 0, int c = 0) : line(l), col(c) {}
};

// ─── Literals ───
struct NumberNode : ASTNode {
    double value;
    NumberNode(double v, int l, int c) : ASTNode(l, c), value(v) {}
};

struct StringNode : ASTNode {
    std::string value;
    StringNode(const std::string& v, int l, int c) : ASTNode(l, c), value(v) {}
};

struct BoolNode : ASTNode {
    bool value;
    BoolNode(bool v, int l, int c) : ASTNode(l, c), value(v) {}
};

struct NullNode : ASTNode {
    NullNode(int l, int c) : ASTNode(l, c) {}
};

struct ListNode : ASTNode {
    std::vector<std::shared_ptr<ASTNode>> elements;
    ListNode(std::vector<std::shared_ptr<ASTNode>> e, int l, int c) : ASTNode(l, c), elements(std::move(e)) {}
};

struct DictNode : ASTNode {
    std::vector<std::pair<std::string, std::shared_ptr<ASTNode>>> pairs;
    DictNode(std::vector<std::pair<std::string, std::shared_ptr<ASTNode>>> p, int l, int c) : ASTNode(l, c), pairs(std::move(p)) {}
};

// ─── Variables ───
struct VariableNode : ASTNode {
    std::string name;
    VariableNode(const std::string& n, int l, int c) : ASTNode(l, c), name(n) {}
};

struct VarDeclNode : ASTNode {
    std::string typeAnnotation;
    std::string name;
    std::shared_ptr<ASTNode> init;
    VarDeclNode(const std::string& type, const std::string& n, std::shared_ptr<ASTNode> i, int l, int c)
        : ASTNode(l, c), typeAnnotation(type), name(n), init(std::move(i)) {}
};

struct AssignNode : ASTNode {
    std::string name;
    std::shared_ptr<ASTNode> value;
    AssignNode(const std::string& n, std::shared_ptr<ASTNode> v, int l, int c)
        : ASTNode(l, c), name(n), value(std::move(v)) {}
};

// ─── Operations ───
struct BinaryOpNode : ASTNode {
    TokenType op;
    std::shared_ptr<ASTNode> left, right;
    BinaryOpNode(TokenType o, std::shared_ptr<ASTNode> l, std::shared_ptr<ASTNode> r, int ln, int c)
        : ASTNode(ln, c), op(o), left(std::move(l)), right(std::move(r)) {}
};

struct UnaryOpNode : ASTNode {
    TokenType op;
    std::shared_ptr<ASTNode> operand;
    UnaryOpNode(TokenType o, std::shared_ptr<ASTNode> e, int l, int c)
        : ASTNode(l, c), op(o), operand(std::move(e)) {}
};

// ─── Control Flow ───
struct IfNode : ASTNode {
    std::shared_ptr<ASTNode> condition;
    std::vector<std::shared_ptr<ASTNode>> body;
    std::vector<std::shared_ptr<ASTNode>> elseBody;
    IfNode(std::shared_ptr<ASTNode> cond, std::vector<std::shared_ptr<ASTNode>> b,
           std::vector<std::shared_ptr<ASTNode>> eb, int l, int c)
        : ASTNode(l, c), condition(std::move(cond)), body(std::move(b)), elseBody(std::move(eb)) {}
};

struct WhileNode : ASTNode {
    std::shared_ptr<ASTNode> condition;
    std::vector<std::shared_ptr<ASTNode>> body;
    WhileNode(std::shared_ptr<ASTNode> cond, std::vector<std::shared_ptr<ASTNode>> b, int l, int c)
        : ASTNode(l, c), condition(std::move(cond)), body(std::move(b)) {}
};

struct ForNode : ASTNode {
    std::shared_ptr<ASTNode> init;
    std::shared_ptr<ASTNode> condition;
    std::shared_ptr<ASTNode> update;
    std::vector<std::shared_ptr<ASTNode>> body;
    ForNode(std::shared_ptr<ASTNode> i, std::shared_ptr<ASTNode> c, std::shared_ptr<ASTNode> u,
            std::vector<std::shared_ptr<ASTNode>> b, int l, int col)
        : ASTNode(l, col), init(std::move(i)), condition(std::move(c)), update(std::move(u)), body(std::move(b)) {}
};

struct EachNode : ASTNode {
    std::string varName;
    std::shared_ptr<ASTNode> iterable;
    std::vector<std::shared_ptr<ASTNode>> body;
    EachNode(const std::string& v, std::shared_ptr<ASTNode> it, std::vector<std::shared_ptr<ASTNode>> b, int l, int c)
        : ASTNode(l, c), varName(v), iterable(std::move(it)), body(std::move(b)) {}
};

// ─── Functions ───
struct FuncDeclNode : ASTNode {
    std::string name;
    std::vector<std::string> params;
    std::vector<std::shared_ptr<ASTNode>> body;
    FuncDeclNode(const std::string& n, std::vector<std::string> p, std::vector<std::shared_ptr<ASTNode>> b, int l, int c)
        : ASTNode(l, c), name(n), params(std::move(p)), body(std::move(b)) {}
};

struct ReturnNode : ASTNode {
    std::shared_ptr<ASTNode> value;
    ReturnNode(std::shared_ptr<ASTNode> v, int l, int c) : ASTNode(l, c), value(std::move(v)) {}
};

struct CallNode : ASTNode {
    std::shared_ptr<ASTNode> callee;
    std::vector<std::shared_ptr<ASTNode>> args;
    CallNode(std::shared_ptr<ASTNode> c, std::vector<std::shared_ptr<ASTNode>> a, int l, int col)
        : ASTNode(l, col), callee(std::move(c)), args(std::move(a)) {}
};

// ─── Property Access ───
struct DotAccessNode : ASTNode {
    std::shared_ptr<ASTNode> object;
    std::string property;
    DotAccessNode(std::shared_ptr<ASTNode> o, const std::string& p, int l, int c)
        : ASTNode(l, c), object(std::move(o)), property(p) {}
};

struct IndexAccessNode : ASTNode {
    std::shared_ptr<ASTNode> object;
    std::shared_ptr<ASTNode> index;
    IndexAccessNode(std::shared_ptr<ASTNode> o, std::shared_ptr<ASTNode> i, int l, int c)
        : ASTNode(l, c), object(std::move(o)), index(std::move(i)) {}
};

// ─── Try-Catch ───
struct TryCatchNode : ASTNode {
    std::vector<std::shared_ptr<ASTNode>> tryBody;
    std::string catchVar;
    std::vector<std::shared_ptr<ASTNode>> catchBody;
    TryCatchNode(std::vector<std::shared_ptr<ASTNode>> tb, const std::string& cv,
                 std::vector<std::shared_ptr<ASTNode>> cb, int l, int c)
        : ASTNode(l, c), tryBody(std::move(tb)), catchVar(cv), catchBody(std::move(cb)) {}
};

// ─── Print ───
struct PrintNode : ASTNode {
    std::shared_ptr<ASTNode> value;
    PrintNode(std::shared_ptr<ASTNode> v, int l, int c) : ASTNode(l, c), value(std::move(v)) {}
};

// ─── Block ───
struct BlockNode : ASTNode {
    std::vector<std::shared_ptr<ASTNode>> statements;
    BlockNode(std::vector<std::shared_ptr<ASTNode>> s, int l, int c) : ASTNode(l, c), statements(std::move(s)) {}
};
