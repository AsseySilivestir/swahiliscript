
         
class ErrorHandler {
  constructor() {
    this.log = globalLog;
  };

  throw(msg, line, col) {
    let err;
    if (line && col) {
      err = `\n\n${msg} -- ln: ${line}, col: ${col}\n`
    } else {
      err = `\n\n${msg}\n`
    };
    try {
      throw new Error(err);
    } catch (e) {
      console.error(e);
      this.log.error(e, line);
      // process.exit(1);
    };
  };
};


class Environment {
  constructor(enclosing) {
    this.errorHandler = new ErrorHandler();
    this.values = {};
    this.enclosing = null;
    if (enclosing) {
      this.enclosing = enclosing;
    };
  };

  define(identifier, value) {
    this.values[identifier] = value;
  };

  assign(identifier, value) {
    if (!Object.keys(this.values).includes(identifier))
    {
      if (this.enclosing) 
      {
        return this.enclosing.assign(identifier, value);
      } 
      else 
      {
        this.errorHandler.throw(
          `UNDEFINED VARIABLE ${identifier}`
        );
      }
    } 
    else 
    {
      this.values[identifier] = value;
    };
  };

  get(identifier) {
    if (Object.keys(this.values).includes(identifier)) 
    {
      return this.values[identifier];
    }
    else 
    {
      if (this.enclosing) 
      {
        return this.enclosing.get(identifier);
      };
      this.errorHandler.throw(
        `UNDEFINED VARIABLE ${identifier}`
      );
    };
  };
};

















class Assignment {
  constructor(token, expression, evaluator, environment) {
    this.identifier = token.value;
    this.expression = expression;

    this.evaluator = evaluator;
    this.environment = environment;
    this.evaluator.load(expression);
    this.value = this.evaluator.evaluate().value;
    this.operate();
  };
  operate() {
    this.environment.assign(this.identifier, this.value);
  };
};

class Binary {
  constructor(leftNode, operator, rightNode, evaluator) {
    this.evaluator = evaluator;

    this.evaluator.load(leftNode);
    this.leftNode = this.evaluator.evaluate();

    this.evaluator.load(rightNode);
    this.rightNode = this.evaluator.evaluate();
    
    this.operator = operator.type;
    this.value = this.operate();
  };

  operate() {
    if (this.operator == 'PLUS') {
      return this.leftNode.value + this.rightNode.value;
    };
    if (this.operator == 'MINUS') {
      return this.leftNode.value - this.rightNode.value;
    };
    if (this.operator == 'MULTIPLY') {
      return this.leftNode.value * this.rightNode.value;
    };
    if (this.operator == 'DIVIDE') {
      return this.leftNode.value / this.rightNode.value;
    };
    if (this.operator == 'MODULO') {
      return this.leftNode.value % this.rightNode.value;
    };
    if (this.operator == 'EQUALTO') {
      return this.leftNode.value == this.rightNode.value;
    };
    if (this.operator == 'NOTEQUALTO') {
      return this.leftNode.value != this.rightNode.value;
    };
    if (this.operator == 'GREATERTHAN') {
      return this.leftNode.value > this.rightNode.value;
    };
    if (this.operator == 'LESSTHAN') {
      return this.leftNode.value < this.rightNode.value;
    };
    if (this.operator == 'GREATERTHANEQUAL') {
      return this.leftNode.value >= this.rightNode.value;
    };
    if (this.operator == 'LESSTHANEQUAL') {
      return this.leftNode.value <= this.rightNode.value;
    };
  }
};

class Unary {
  constructor(operator , expression, evaluator) {
    this.evaluator = evaluator;
    this.evaluator.load(expression);

    this.operator = operator;
    this.expression = expression;
    this.value = this.operate();
  }
  operate() {
    if (this.operator.type == "MINUS") {  
      return ( - ( this.evaluator.evaluate().value ) );
    };
    if (this.operator.type == "PLUS") {
      return (this.evaluator.evaluate().value);
    }
    if (this.operator.type == "NOT") {
      return !(this.evaluator.evaluate().value);
    }
  };
}

class Call {
  constructor(callee, args, evaluator, environment) {
    this.errorHandler = new ErrorHandler();
    this.callee = callee;
    this.evaluator = evaluator;
    this.args = this.evaluateArgs(args);
    this.environment = environment;
    this.value = this.operate();
  };

  evaluateArgs(args) {
    let parsedArgs = [];
    for (let arg of args) {
      this.evaluator.load(arg);
      let argValue = this.evaluator.evaluate().value;
      parsedArgs.push(argValue);
    }
    return parsedArgs;
  };

  operate() {
    const zapFunction = this.environment.get(this.callee.value);
    if (!(zapFunction instanceof ZapFunction)) {
      this.errorHandler.throw(
        `INVALID CALLEE TYPE`,
        this.callee.line,
        this.callee.col,
      );
    };
    return zapFunction.call(this.args);
  };
};

class Literal {
  constructor(token) {
    if (token.type == "NUMBER") {
      this.value = parseFloat(token.value);
    };
    if (token.type == "STRING") {
      this.value = token.value;
    };
  };
};

class Group {
  constructor(expression, evaluator) {
    this.evaluator = evaluator;
    this.evaluator.load(expression);
    this.value = this.evaluator.evaluate().value;
  };
};

class Variable {
  constructor(token, environment) {
    this.identifier = token.value;
    this.environment = environment;
    this.value = this.fetchValue();
  }
  fetchValue() {
    return this.environment.get(this.identifier);
  };
}

/*
                 ::::{[{[ --> THE EVALUATING LOGIC <-- ]}]}::::

        The logic behind the evaluator is to create a tree of operations.
      It starts by iterating through the Whole raw expression (token list),
                            from right to left,
              trying to find the operators of lowest precedence 
                    (the ones that will be executed last).
              As soon as it finds an operator of type "+" or "-",
                 it becomes the first expression in the tree.
       The expressions can be of 4 types: Binary, Unary, Group or Literal.

             The Evaluator will iterate through the raw Expression,
                  Always trying break down bigger expressions
             into smaller ones until it works with only Primaries.

                             THE EXPRESSION TYPES

          Binary Expressions :
            --> Have a left and right sub-expression, along with an operator.
            --> The expression's value is calculated by
                joining the values of the left and right 
                sub-expressions through the operator.
            --> EXAMPLES:
      
          1.     "PLUS"                    2.        "MULTPLY"                                            
                   /\                                    /\                            
                  /  \                                  /  \                           
                 5    6                               5+6  7-3                    
                                                                                  
           Calculated Value: 11                  Calculated Value: 44                                                                 
                         
            --> {{ RECURSION ALERT }}
                Notice how in Example 2,
                the sub-expressions are also of type "Binary Expression"   



          Unary Expressions :
            --> Have a sub-expression, along with a unary operator ("!" or "-").
            --> The expression's value is calculated by
                joining the value of the sub-expression with the operator.
            --> EXAMPLES:
      
          1.     "PLUS"                    2.        "MINUS"                                            
                    |                                   |                           
                    5                                   9                     
                                                                
                                                                                  
           Calculated Value: 5                  Calculated Value: -9                                                                 
                          


          Group Expressions :
            --> Are the ones in between parenthesis.
            --> The expression's value is calculated by parsing
                the expression in between parenthesis.
            --> Examples:
          
          1.    "(2 + 3)"                                                             
                    |
                    V                                                         
                   2+3    
                    |
                    V
                  "PLUS"                                           
                    /\                                            
                   /  \
                  2    3
                   
           Calculated Value: 5                   
                
                     
           
          Primary Expressions :
            --> Are the ones that represent a Literal (String, Int, Float, etc.).
            --> The expression's value is the Literal it holds.
            --> Examples:
          
          1.      "245"                                                             
                    
           Calculated Value: 245                              


                            {[{[ --> EXAMPLE <--]}]}
                                                                                                                                                                                  
                    (3 + 5) - 8 * (4 - (8 / 2) - 7) + 4 * (9)                                                                                                                                                    
                                                    |                                                                                                                              
                                                  "PLUS"                                                                                                                                           
                                                    /\                                                                                                                                         
                                                   /  \                                                                                                                                        
                     (3 + 5) - 8 * (4 - (8 / 2) - 7)   4 * (9)                                                                                                                                                                 
                             |                           |                                    
                          "MINUS"                      "MULT"                                                                                                                                  
                            /\                           /\                                                                                                                                                                                       
                           /  \                         4   (9)                                                                                                                                                       
                          /    \                             |                                                                    
                  (3 + 5)      8 * (4 - (8 / 2) - 7)         9                                                                                       
                /                |                                                                                                          
          GROUP(3+5)         "MULTIPLY"                                                                                                      
              |                  /\                                                                                         
            3 + 5               /  \                                                                     
              |                8    (4 - (8 / 2) - 7)                                                         
            "PLUS"                          |                             
              /\                     4 - (8 / 2) - 7                                                     
             /  \                                |                                         
            3    5                            "MINUS"                                 
                                                 /\                             
                                                /  \                              
                                    4 - (8 / 2)      7                         
                                      |                                        
                                   "MINUS"                                          
                                      /\                                                                        
                                     /  \                                                                                                        
                                    4    (8 / 2)                                                                    
                                            |                                                                
                                          8 / 2                                                                  
                                            |                                                                
                                         "DIVIDE"                                                                   
                                            /\                                                                
                                           /  \        
                                          8    2
                                           

*/

class Evaluator {
  constructor(environment) {
    this.environment = environment;

    this.errorHandler = new ErrorHandler();
    this.rawExpression = null;
    this.index = null;
    this.previousToken = null;
    this.currentToken = null;
    this.nextToken = null;
    this.openingParen = 0;
    this.closingParen = 0;
    this.bars = 0;
  };

  load(tokens) {
    this.rawExpression = tokens;
    this.resetToEnd();
  }

  reset() {
    this.index = 0;
    this.previousToken = null;
    this.currentToken = this.rawExpression[this.index];
    this.nextToken = this.rawExpression[this.index+1];
    this.openingParen = 0;
    this.closingParen = 0;

    this.checkParenthese();
    this.checkBar();
  };

  resetToEnd() {
    this.index = this.rawExpression.length - 1;
    this.previousToken = this.rawExpression[this.index - 1];
    this.currentToken = this.rawExpression[this.index];
    this.nextToken = null;
    this.openingParen = 0;
    this.closingParen = 0;

    this.checkParenthese();
    this.checkBar();
  };

  next() {
    this.index++;
    this.previousToken = this.rawExpression[this.index-1];
    this.currentToken = this.rawExpression[this.index];
    this.nextToken = this.rawExpression[this.index+1];
    
    this.checkParenthese();
    this.checkBar();
  };

  prev() {
    this.index--;
    this.previousToken = this.rawExpression[this.index-1];
    this.currentToken = this.rawExpression[this.index];
    this.nextToken = this.rawExpression[this.index+1];
    
    this.checkParenthese();
    this.checkBar();
  };

  checkParenthese() {
    if (this.currentToken) {
      if (this.currentToken.type == "LPAREN") {
        this.openingParen++;
      };
      if (this.currentToken.type == "RPAREN") {
        this.closingParen++;
      };
    };
  };

  checkBar() {
    if (this.currentToken) {
      if (this.currentToken.type == "BAR") {
        this.bars++;
      };
    };
  };

  isInGroup() {
    return (this.openingParen != this.closingParen) || (this.bars % 2 != 0);
  }

  isOperator(token) {
    let operators = [
      "MULTIPLY", 
      "DIVIDE", 
      "PLUS", 
      "MINUS", 
      "MODULO", 
      "GREATERTHAN", 
      "GREATERTHANEQUAL",
      "LESSTHAN",
      "LESSTHANEQUAL", 
      "EQUALTO",
      "NOTEQUALTO",
      "NOT",
    ];
    return (operators.includes(token.type) );
  };

  isEqualityOperator(token) {
    let operators = [
      "EQUALTO",
      "NOTEQUALTO",
    ];
    return (operators.includes(token.type) );
  }

  isComparissonOperator(token) {
    let operators = [ 
      "GREATERTHAN", 
      "GREATERTHANEQUAL",
      "LESSTHAN",
      "LESSTHANEQUAL", 
    ];
    return (operators.includes(token.type) );
  }

  isAdditionOperator(token) {
    let operators = [
      "PLUS",
      "MINUS",
    ];
    return (operators.includes(token.type) );
  }

  isMultiplicationOperator(token) {
    let operators = [
      "MULTIPLY",
      "DIVIDE",
      "MODULO",
    ];
    return (operators.includes(token.type) );
  }

  isUnaryOperator(token) {
    let operators = [
      "MINUS",
      "NOT",
      "PLUS",
    ];
    return (operators.includes(token.type) );
  }

  isLiteral(token) {
    let types = [
      "STRING",
      "NUMBER",
    ];
    return (types.includes(token.type) );
  }

  isReserved(token) {
    let types = [ 
      "FOR", 
      "WHILE",
      "RETURN",
      "SHOW", 
    ];
    return types.includes(token.type);
  };

  isForbidden(token) {
    let types = [ 
      "RBRACE",
      "LBRACE",
      "SEMICOLON", 
      "DOT",
      "DECLARATOR",
    ];
    return types.includes(token.type);
  }

  handleAssignment() {
    // console.log('isAssignment')
    let assigned = this.rawExpression.slice(0, this.index);
    let expression = this.rawExpression.slice(this.index+1);

    if (assigned.length != 1 || !expression.length) {
      this.errorHandler.throw(
        'UNABLE TO PARSE ASSIGNMENT',
        this.currentToken.line,
        this.currentToken.col
      );
    };

    let identifier = assigned[0];

    if (identifier.type != 'IDENTIFIER') {
      this.errorHandler.throw(
        'INVALID ASSIGNEE',
        this.currentToken.line,
        this.currentToken.col
      );
    };

    let node = new Assignment(
      identifier,
      expression,
      this,
      this.environment
    );
    return node;
  };

  handleBinary() {
    // console.log('isBinary')
    let leftNode = this.rawExpression.slice(0, this.index);
    let rightNode = this.rawExpression.slice(this.index+1);

    if (!leftNode.length || !rightNode.length) {
      this.errorHandler.throw(
        'UNABLE TO PARSE BINARY EXPRESSION',
        this.currentToken.line,
        this.currentToken.col
      );
    };

    let node = new Binary(
      leftNode,
      this.currentToken,
      rightNode,
      this
    )
    return node;
  }

  handleUnary() {
    // console.log('isUnary')
    let expr = this.rawExpression.slice(this.index+1);

    if (!expr.length) {
      this.errorHandler.throw(
        'UNABLE TO PARSE UNARY EXPRESSION',
        this.currentToken.line,
        this.currentToken.col
      );
    }

    let node = new Unary(
      this.currentToken,
      expr,
      this,
    );
    return node;
  };

  handleCall() {
    let callee = this.previousToken;
    let args = [];
    let currentArgument = [];

    this.next();
    if (!this.currentToken) {
      this.errorHandler.throw(
        `UNABLE TO PARSE CALL EXPRESSION`,
        this.previousToken.line,
        this.previousToken.col
      );
    }

    while (this.currentToken.type != 'BAR') {
      if (this.currentToken.type != 'COMMA') {
        currentArgument.push(this.currentToken);
      } else {
        args.push(currentArgument);
        currentArgument = [];
      };
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(
          `EXPECTED '|' after argument list`,
          this.previousToken.line,
          this.previousToken.col
        )
      };
    };

    if (currentArgument.length) {
      args.push(currentArgument);
      currentArgument = [];
    }
    
    let node = new Call(
      callee,
      args,
      this,
      this.environment,
    )
    return node;
  };

  handleOpenParen() {
    // console.log('isGroup')
    let group = []
    while (this.isInGroup()) {
      group.push(this.currentToken);
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(`EXPECTED ')' AFTER EXPRESSION -- EOF`);
      };
    };
    let node = new Group(
      group,
      this
      );
    return node;
  };

  handlePrimary() {
    // console.log('isPrimary')
    let node = new Literal(this.currentToken);
    return node;
  };

  handleVariable() {
    // console.log('isVariable')
    let node = new Variable(
      this.currentToken, 
      this.environment
    );
    return node;
  };

  handleReserved() {
    this.errorHandler.throw(
      'UNEXPECTED KEYWORD',
      this.currentToken.line,
      this.currentToken.col,
    );
  };

  handleForbidden() {
    this.errorHandler.throw(
      'FORBIDDEN SYMBOL IN EXPRESSION',
      this.currentToken.line,
      this.currentToken.col,
    );
  };

  evaluate() {
    // console.log('expression to parse');
    // console.log(this.rawExpression);

    /*
      Parsing the expressions with lowest precedence (EQUALITY)
      We iterate through the rawExpression from right to left due to the association rule of these operators.

      The order of precedence is as follows
      --> EQUALITY
      --> COMPARISSON
      --> ADDITION - SUBTRACTION
      --> MULTIPLICATION - DIVISION
      --> UNARY
      --> GROUP
      --> PRIMARY
    */


    while (this.currentToken) {
      if (this.isForbidden(this.currentToken)) {
        this.handleForbidden();
      };
      this.prev();
    };
    this.resetToEnd();

    while (this.currentToken) {
      if (this.isReserved(this.currentToken)) {
        this.handleReserved();
      };
      this.prev();
    };
    this.reset();

    while (this.currentToken && this.nextToken) {
      if (this.isLiteral(this.currentToken) && this.isLiteral(this.nextToken)) { 
        this.errorHandler.throw(
          'UNEXPECTED LITERAL',
          this.nextToken.line,
          this.nextToken.col
        );
      };
      this.next();
    };
    this.reset();

    while (this.currentToken) {
      if (this.currentToken.type == 'EQUALS') {
        if (!this.isInGroup()) {
          return this.handleAssignment();
        };
      };
      this.next();
    };
    this.resetToEnd();

    while (this.index >= 0) {
      if (this.isEqualityOperator(this.currentToken)) {
        if (!this.isInGroup()) {
          return this.handleBinary();
        };
      };
      this.prev();
    };
    this.resetToEnd();

    while (this.index >= 0) {
      if (this.isComparissonOperator(this.currentToken)) {
        if (!this.isInGroup()) {
          return this.handleBinary();
        };
      };
      this.prev();
    };
    this.resetToEnd();

    while (this.index >= 0) {
      if (this.isAdditionOperator(this.currentToken)) {
        if (!this.isInGroup()) {
          if (this.previousToken) {
            if (!this.isOperator(this.previousToken)) {
              return this.handleBinary();
            };
          };
        };
      };
      this.prev();
    };
    this.resetToEnd();

    while (this.index >= 0) {
      if (this.isMultiplicationOperator(this.currentToken)) {
        if (!this.isInGroup()) {
          return this.handleBinary();
        };
      };
      this.prev();
    };
    this.reset();

    while (this.currentToken) {
      if (this.isUnaryOperator(this.currentToken)) {
        if (!this.isInGroup()) {
          return this.handleUnary();
        };
      };
      this.next();
    };
    this.reset();

    while (this.currentToken) {
      if (this.currentToken.type == 'BAR') {
        return this.handleCall();
      };
      this.next();
    };
    this.reset();

    while (this.currentToken) {
      if (this.currentToken.type == "LPAREN") {
        this.next();
        return this.handleOpenParen();
      };
      this.next();
    };
    this.reset();

    while (this.currentToken) {
      if (this.currentToken.type == "NUMBER" || this.currentToken.type == "STRING") {
        return this.handlePrimary();
      };
      this.next();
    };
    this.reset();

    while (this.currentToken) {
      if (this.currentToken.type == "IDENTIFIER") {
        return this.handleVariable();
      };
      this.next();
    };
    this.reset();

    return {
      value : undefined,
    };

  };
};




// const { Environment } = require('../environment/Environment');
// const { Lexer } = require('../lexer/lexer');

// console.time('parsing')
// const env = new Environment();
// const lexer = new Lexer("1");
// const parser = new Parser(env);
// parser.load(lexer.tokens);
// result = parser.parse();
// console.log(result);

// console.timeEnd('parsing')





class Interpreter {
  constructor(input) {
    globalLog.clear();
    
    this.errorHandler = new ErrorHandler();
    this.environment = new Environment(null);
    this.lexer = new Lexer(input);
    this.parser = new Parser(this.environment);
    this.parser.load(this.lexer.tokens);
    this.statements = this.parser.parse();
  };
};



























class CharSeperator {
  constructor(input) {
    this.errorHandler = new ErrorHandler();
    this.input = input;
    this.charTypes = [];
    this.getCharTypes();
  };

  getCharTypes() {
    let line = 1;
    let col = 1;
    for (let char of this.input.split('')) {
      for (let [ token , verification ] of Object.entries(tokenList)) {
        if (verification(char)) {
          const charDescription = {};
          charDescription['type'] = token;
          charDescription['line'] = line;
          charDescription['col'] = col;
          charDescription['value'] = char;
          if (charDescription.type == "UNRECOGNIZED") {
            this.errorHandler.throw(`UNRECOGNIZED SYNTAX`, charDescription['line'], charDescription['col']);
          } else {
            this.charTypes.push(charDescription);
          };
          break;
        }
      }
      if (char == '\n') {
        col = 1;
        line++;
      } else {
        col++;
      };
    };
  };
};


/*



                          {[{[ --> THE LEXER <-- ]}]}

                  The goal here is to take a stream of inputs
               & separate it into tokens that have meaning to the
                                   language.

               We start by separating each character of the stream
                                  by its type.
                             The possible types are:

           1. +  2. -  3. *  4. /  5. %  6. =  7. == 8. != 9. >  10.  <

           11.<= 12.<= 13. ! 14. ( 15. ) 16. { 17. } 18. ; 19. ' 20. .

       Besides these types, the char can be a Letter, Number or Whitespace.


              After classifying all the characters, we can move on
          to grouping these symbols into larger lexemes or tokens that
                   our language will be able to understand.



*/


class Lexer {
  constructor (input) {
    this.charSeperator = new CharSeperator(input);
    this.errorHandler = new ErrorHandler();
    this.charTypes = this.charSeperator.charTypes;
    this.index = 0;
    this.char = this.charTypes[this.index];
    this.currentToken = {};
    this.tokens = [];
    this.lex();
  }

  resetCurrentToken() {
    this.currentToken = {};
  }

  next() {
    this.index++;
    this.char = this.charTypes[this.index];
  };

  peakNext() {
    try {
      return this.charTypes[this.index + 1];
    } catch {
      return false;
    };
  };

  handleStr() {
    this.currentToken = {
      "type" : "STRING",
      "line" : this.char.line,
      "col" : this.char.col,
      "value" : "",
    };

    if (this.peakNext()) {
      this.next();
    } else {
      this.errorHandler.throw('EOF WHILE PARSING STRING', this.currentToken.line, this.currentToken.col);
    }

    while (this.char.type != "QUOTE") {
      this.currentToken.value = this.currentToken.value.concat(this.char.value);
      this.next();
      if (!this.char) {
        this.errorHandler.throw('EOF WHILE PARSING STRING', this.currentToken.line, this.currentToken.col);
      };
    };
    this.tokens.push(this.currentToken);
    this.resetCurrentToken();
    this.next();
    this.lex();
  };

  handleNum() {
    let hasDecimal = false;

    this.currentToken = {
      "type" : "NUMBER",
      "line" : this.char.line,
      "col" : this.char.col,
      "value" : "",
    };

    // Long statements to handle decimal and int numbers
    while (this.char.type == "NUMBER" || (!hasDecimal && this.char.type == "DOT" && this.peakNext() && this.peakNext().type == "NUMBER")) {
      if (this.char.type == "DOT") {
        hasDecimal = true;
      };
      this.currentToken.value = this.currentToken.value.concat(this.char.value);
      this.next();
      if (!this.char) {
        break;
      };
    };
    this.tokens.push(this.currentToken);
    this.resetCurrentToken();
    this.lex();
  };

  handleId() {
    this.currentToken = {
      "type" : "IDENTIFIER",
      "line" : this.char.line,
      "col" : this.char.col,
      "value" : "",
    };

    while (this.char.type == "NUMBER" || this.char.type == "LETTER") {
      this.currentToken.value = this.currentToken.value.concat(this.char.value);
      this.next();
      if (!this.char) {
        break;
      };
    };

    if (Object.keys(reserved).includes(this.currentToken.value)) {
      this.currentToken.type = reserved[this.currentToken.value];
    };

    this.tokens.push(this.currentToken);
    this.resetCurrentToken();
    this.lex();
  };


  isDoubleCharOperator() {
    if (this.peakNext()) {
      let operatorToTest = this.char.value.concat(this.peakNext().value)
      for (let [ type , verification ] of Object.entries(tokenList)) {
        if (verification(operatorToTest) && (type != "UNRECOGNIZED")) {
          return {
            "type" : type,
            "line" : this.char.line,
            "col" : this.char.col,
            "value" : operatorToTest,
          };
        };
      };
      return false;
    };
  };

  handleOperator() {
    if (this.char.type != "WHITESPACE") {
      let doubleCharOperator = this.isDoubleCharOperator();
      if (doubleCharOperator) {
        this.next();
        this.currentToken = doubleCharOperator;
        this.tokens.push(this.currentToken);
        this.resetCurrentToken();
      } else {
        this.currentToken = this.char;
        this.tokens.push(this.currentToken);
        this.resetCurrentToken();
      };
    };
    this.next();
    this.lex();
  };

  lex() {
    if (this.char) {
      switch(this.char.type) {
        case "QUOTE":
          this.handleStr();
          break;
        case "NUMBER":
          this.handleNum();
          break;
        case "LETTER":
          this.handleId();
          break;
        default:
          this.handleOperator();
      };
    };
  };
};









const tokenList = {
  "PLUS" : (input) => input == '+',
  "MINUS" : (input) => input == '-',
  "DIVIDE" : (input) => input == '/',
  "MULTIPLY" : (input) => input == '*',
  "MODULO" : (input) => input == '%',

  "EQUALS" : (input) => input == '=',

  "GREATERTHAN" : (input) => input == '>',
  "LESSTHAN" : (input) => input == '<',
  "NOT" : (input) => input == '!',
  "GREATERTHANEQUAL" : (input) => input == '>=',
  "LESSTHANEQUAL" : (input) => input == '<=',
  "NOTEQUALTO" : (input) => input == '!=',
  "EQUALTO" : (input) => input == '==',

  "FATARROW" : (input) => input == '=>',

  "LPAREN" : (input) => input == '(',
  "RPAREN" : (input) => input == ')',
  "LBRACE" : (input) => input == '{',
  "RBRACE" : (input) => input == '}',

  "BAR" : (input) => input == ':',
  "COMMA" : (input) => input == ',',

  "SEMICOLON" : (input) => input ==';',
  "QUOTE" : (input) => input == "'",
  "DOT" : (input) => input =='.',

  "DECLARATOR" : (input) => input == '$',

  "NUMBER" : (input) => /^[0-9]+$/.test(input),
  "LETTER" : (input) => /^[a-zA-Z]+$/.test(input),
  "WHITESPACE" : (input) => !/\S/.test(input),

  "UNRECOGNIZED" : (input) => true,
};

const reserved = {
  "ikiwa" : 'FOR',
  "wakati" : 'WHILE',
  "rudisha" : 'RETURN',
  "andika" : "SHOW",
  "kama" : "IF",
  "au" : "ELSE",
  "kazi" : "FUNCTION",
};





//changed  the  keys  

























class Log {
  constructor() {
    this.values = [];
  };

  add(log) {
    this.values.push({
      'log': log,
    });
  };

  error(e, ln) {
    this.values.push({
      'error' : {
        'message' : e.message,
        'line' : ln,
      }
    });
  };
  
  clear() {
    this.values = [];
    return this;
  };
};





let globalLog = new Log();






class BlockStmt {
  constructor(statement, environment) {
    this.statement = statement;
    this.body = this.fetchBody();
    this.parser = new Parser(environment);
    this.execute()
  };

  fetchBody() {
    return this.statement.slice(1, -1);
  };

  execute() {
    this.parser.load(this.body);
    this.statements = this.parser.parse();
  };
};

class PrintStmt {
  constructor(statement, evaluator, log) {
    this.log = log;
    this.statement = statement;
    this.expression = this.fetchExpression();
    this.evaluator = evaluator;
    this.value = null;
    this.execute();
  };

  fetchExpression() {
    return this.statement.slice(1);
  };

  execute() {
    this.evaluator.load(this.expression);
    this.value = this.evaluator.evaluate().value;

    if (this.value != undefined) {
      // console.log(this.value);
      this.log.add(this.value);

    } else {
      // console.log();
      this.log.add('');
    };
  };
};

class ExprStmt {
  constructor(statement, evaluator) {
    this.expression = statement;
    this.evaluator = evaluator;
    this.evaluator.load(this.expression);
    this.value = this.evaluator.evaluate().value;
  }
}

class DeclarationStmt {
  constructor(statement, evaluator, environment) {
    this.errorHandler = new ErrorHandler();
    this.statement = statement;
    this.evaluator = evaluator;
    this.environment = environment;

    this.value = null;
    this.identifier = statement[1].value;
    this.execute()
  };

  fetchValue() {
    let value = null;
    if (this.statement[2]) {
      if (this.statement[2].type == 'EQUALS') {
        let expression = this.statement.slice(3);
        this.evaluator.load(expression);
        value = this.evaluator.evaluate().value;
        if (value == undefined) {
          this.errorHandler.throw(
            'INVALID DECLARATION STATEMENT',
            this.statement[0].line,
            this.statement[0].col
          );
        };
      }
      else {
        this.errorHandler.throw(
          'INVALID DECLARATION STATEMENT',
          this.statement[0].line,
          this.statement[0].col
        );
      };
    };
    return value;
  };
    
  
  execute() {
      this.value = this.fetchValue();
      return this.environment.define(this.identifier, this.value);
  };
};

class IfStmt {
  constructor(statement, evaluator, environment) {
    this.evaluator = evaluator;
    this.parser = new Parser(environment);
    this.errorHandler = new ErrorHandler();

    this.statement = statement;

    this.expression = [];
    this.thenBlock = [];
    this.elseBlock = null;

    this.index = 1;
    this.currentToken = this.statement[this.index];
    this.prevToken = null;

    this.openingBrace = 0;
    this.closingBrace = 0;

    this.execute();
  };

  next() {
    this.prevToken = this.statement[this.index];
    this.index++;
    this.currentToken = this.statement[this.index];
    this.checkBrace();
  };

  checkBrace() {
    if (this.currentToken) {
      if (this.currentToken.type == 'LBRACE') {
        this.openingBrace++;
      };
      if (this.currentToken.type == 'RBRACE') {
        this.closingBrace++;
      };
    };
  };

  isInBlock() {
    return this.closingBrace != this.openingBrace;
  };

  splitBlock() {
    while (!this.isInBlock()) {
      this.expression.push(this.currentToken);
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(
          `EXPECTED '{' AFTER EXPRESSION`,
          this.prevToken.line,
          this.prevToken.col
        );
      };
    };

    while (this.isInBlock()) {
      this.thenBlock.push(this.currentToken);
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(
          `EXPECTED '}' AFTER THEN BLOCK`,
          this.prevToken.line,
          this.prevToken.col
        );
      }
    };
    this.thenBlock.push(this.currentToken);
    this.thenBlock.push({
      type: 'SEMICOLON', 
      value: ';'
    });
    this.next();

    if (this.currentToken) {
      if (this.currentToken.type == 'ELSE') {
        this.next();
        if (this.isInBlock()) {
          this.elseBlock = [];

          while (this.isInBlock()) {
            this.elseBlock.push(this.currentToken);
            this.next();
            if (!this.currentToken) {
              this.errorHandler.throw(
                `EXPECTED '}' AFTER ELSE BLOCK`,
                this.prevToken.line,
                this.prevToken.col
              );
            };
          };
          this.elseBlock.push(this.currentToken);
          this.elseBlock.push({
            type: 'SEMICOLON', 
            value: ';'
          });
          this.next();
        }
        else {
          this.errorHandler.throw(
            `UNABLE TO PARSE ELSE STATEMENT`,
            this.prevToken.line,
            this.prevToken.col
          );
        };
      }
      else {
        this.errorHandler.throw(
          `UNEXPECTED KEYWORD AFTER IF STATEMENT`,
          this.prevToken.line,
          this.prevToken.col
        );
      };
    };
  };

  execute() {
    this.splitBlock();

    this.evaluator.load(this.expression);
    let approve = this.evaluator.evaluate().value;

    if (approve) {
      this.parser.load(this.thenBlock);
      this.parser.parse();
    };
    if (!approve) {
      if (this.elseBlock) {
        this.parser.load(this.elseBlock);
        this.parser.parse();
      };
    };
  };
};

class WhileStmt {
  constructor(statement, evaluator, environment) {
    this.evaluator = evaluator;
    this.parser = new Parser(environment);
    this.errorHandler = new ErrorHandler();

    this.statement = statement;

    this.expression = [];
    this.body = [];

    this.index = 1;
    this.currentToken = this.statement[this.index];
    this.prevToken = null;

    this.openingBrace = 0;
    this.closingBrace = 0;

    this.execute();
  };

  next() {
    this.prevToken = this.statement[this.index];
    this.index++;
    this.currentToken = this.statement[this.index];
    this.checkBrace();
  };

  checkBrace() {
    if (this.currentToken) {
      if (this.currentToken.type == 'LBRACE') {
        this.openingBrace++;
      };
      if (this.currentToken.type == 'RBRACE') {
        this.closingBrace++;
      };
    };
  };

  isInBlock() {
    return this.closingBrace != this.openingBrace;
  };

  splitBlock() {
    while (!this.isInBlock()) {
      this.expression.push(this.currentToken);
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(
          `EXPECTED '{' AFTER EXPRESSION`,
          this.prevToken.line,
          this.prevToken.col
        );
      };
    };

    while (this.isInBlock()) {
      this.body.push(this.currentToken);
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(
          `EXPECTED '}' AFTER BODY OF WHILE`,
          this.prevToken.line,
          this.prevToken.col
        );
      }
    };
    this.body.push(this.currentToken);
    this.body.push({
      type: 'SEMICOLON', 
      value: ';'
    });
    this.next()

    if (this.currentToken) {
      this.errorHandler.throw(
        `UNEXPECTED TOKEN AFTER WHILE STATEMENT`,
        this.currentToken.line,
        this.currentToken.col
      );
    };
  };


  execute() {
    this.splitBlock();
    let max = 1000;
    this.evaluator.load(this.expression);
    while (!!this.evaluator.evaluate().value) {
      this.parser.load(this.body);
      this.parser.parse();
      this.evaluator.load(this.expression);
      max--;
      if (max <= 0) {
        this.errorHandler.throw(
          `MAXIMUM NUMBER OF LOOPS EXCEEDED`
        );
        break;
      };
    };
  };
};

class FunctionStmt {
  constructor(statement, evaluator, environment) {
    this.evaluator = evaluator;
    this.environment = environment;
    this.errorHandler = new ErrorHandler();

    this.statement = statement;

    this.identifier = null;
    this.args = [];
    this.body = [];

    this.index = 1;
    this.currentToken = this.statement[this.index];
    this.prevToken = null;

    this.execute();
  };

  next() {
    this.prevToken = this.statement[this.index];
    this.index++;
    this.currentToken = this.statement[this.index];
  };

  splitBlock() {
    this.identifier = this.currentToken.value;
    this.next();
    if (!this.currentToken || this.currentToken.type != 'BAR') {
      this.errorHandler.throw(
        `EXPECTED '|' AFTER FUNCTION DECLARATION`,
        this.prevToken.line,
        this.prevToken.col
      );
    };
    this.next();

    while (this.currentToken && this.currentToken.type != 'BAR') {
      this.args.push(this.currentToken);
      this.next();
      if (!this.currentToken) {
        this.errorHandler.throw(
          `EXPECTED '|' AFTER ARGUMENT LIST`,
          this.prevToken.line,
          this.prevToken.col
        );
      };
      if (this.currentToken.type != 'COMMA' && this.currentToken.type != 'BAR') {
        this.errorHandler.throw(
          `EXPECTED ',' AFTER ARGUMENT`,
          this.prevToken.line,
          this.prevToken.col
        );
      }
      if (this.currentToken.type == 'BAR') {
        break;
      };
      this.next();
    };

    this.next();

    if (!this.currentToken || this.currentToken.type != 'FATARROW') {
      this.errorHandler.throw(
        `EXPECTED '=>' AFTER FN DECLARATION`,
        this.prevToken.line,
        this.prevToken.col
      );
    };
    this.next();

    this.body = this.statement.slice(this.index);
    this.body.push({
      type : 'SEMICOLON',
      value : ';',
    });
  };

  execute() {
    this.splitBlock();
    const zapFunction = new ZapFunction(
      this.identifier, 
      this.args, 
      this.body, 
      this.environment
    );
    this.environment.define(this.identifier, zapFunction);
  };
};

class Parser {
  constructor (environment) {
    this.environment = environment
    this.evaluator = new Evaluator(this.environment);
    this.errorHandler = new ErrorHandler();
    this.log = globalLog;


    this.tokens = null;
    this.index = null;
    this.currentToken = null;
    this.previousToken = null;

    this.statements = [];
    this.currentStatement = [];

    this.openingBrace = 0;
    this.closingBrace = 0;
  };

  load(tokens) {
    this.tokens = tokens;
    this.index = 0;
    this.currentToken = this.currentToken = this.tokens[this.index];
    this.previousToken = null;

    this.openingBrace = 0;
    this.closingBrace = 0;

    this.checkBrace();
  }

  resetCurrentStatement() {
    this.currentStatement = [];
  }

  checkBrace() {
    if (this.currentToken) {
      if (this.currentToken.type == 'LBRACE') {
        this.openingBrace++;
      };
      if (this.currentToken.type == 'RBRACE') {
        this.closingBrace++;
      };
    };
  };

  next() {
    this.index++;
    this.currentToken = this.tokens[this.index];
    this.previousToken = this.tokens[this.index-1];

    this.checkBrace();
  };

  isInBlock() {
    return this.openingBrace != this.closingBrace;
  };

  isSemicolon() {
    return this.currentToken.type == 'SEMICOLON';
  };

  handleBlock(statement) {
    let stmt = new BlockStmt(
      statement,
      new Environment(this.environment),
    );
    // console.log(stmt);
    return stmt;
  };

  handlePrint(statement) {
    let stmt = new PrintStmt(
      statement,
      this.evaluator,
      this.log,
    );
    // console.log(stmt);
    return stmt;
  };

  handleDeclaration(statement) {
    let stmt = new DeclarationStmt(
      statement,
      this.evaluator,
      this.environment,
    );
    // console.log(stmt);
    return stmt;
  };

  handleIf(statement) {
    // console.log(statement);
    let stmt = new IfStmt(
      statement,
      this.evaluator,
      this.environment
    );
    // console.log(stmt);
    return stmt;
  };

  handleExpression(statement) {
    let stmt = new ExprStmt(
      statement,
      this.evaluator,
    );
    // console.log(stmt);
    return stmt;
  };

  handleWhile(statement) {
    let stmt = new WhileStmt(
      statement,
      this.evaluator,
      this.environment
    );
    // console.log(stmt);
    return stmt;
  }

  handleFunction(statement) {
    let stmt = new FunctionStmt(
      statement,
      this.evaluator,
      this.environment
    );
    // console.log(stmt);
    return stmt;
  }

  handleStatement(statement) {
    // console.log(statement);
    if (statement[0].type == 'LBRACE') {
      return this.handleBlock(statement)
    };

    if (statement[0].type == 'SHOW') {
      return this.handlePrint(statement);
    };

    if (statement[0].type == 'DECLARATOR') {
      return this.handleDeclaration(statement);
    };

    if (statement[0].type == 'IF') {
      return this.handleIf(statement);
    };

    if (statement[0].type == 'WHILE') {
      return this.handleWhile(statement);
    };

    if (statement[0].type == 'FUNCTION') {
      return this.handleFunction(statement);
    };

    return this.handleExpression(statement);
  };

  parse() {
    while (this.currentToken) {
      if (!this.isInBlock())
      {
        if (!this.isSemicolon()) {
          this.currentStatement.push(this.currentToken);
        } else {
          let stmt = this.handleStatement(this.currentStatement);
          this.statements.push(stmt);
          this.resetCurrentStatement();
        };
        this.next()
        continue;
      } 
      else 
      {
        this.currentStatement.push(this.currentToken);
        if (!this.isInBlock()) {
          let stmt = this.handleStatement(this.currentStatement);
          this.statements.push(stmt);
          this.resetCurrentStatement();
        };
        this.next();
      };
    };

    if (this.currentStatement.length) {
      this.errorHandler.throw(
        'YOU MUST HAVE FORGOTTEN A SEMICOLON OR CLOSING BRACE',
        this.previousToken.line,
        this.previousToken.col
      );
    };

    return this.statements;

  };
};
























































































class ZapFunction {
  constructor(name, args, body, environment) {
   /// const { Parser } = require('./Parser');

    this.errorHandler = new ErrorHandler();
    this.environment = new Environment(environment);
    this.parser = new Parser(this.environment);
    this.name = name;
    this.args = args;
    this.body = body;
    this.arity = args.length;
  };

  call(args) {
    if (args.length != this.args.length) {
      this.errorHandler.throw(
        `INVALID NUMBER OF ARGUMENTS PASSED TO ${this.name}`,
      )
    };

    for (let i=0; i < args.length; i++) {
      this.environment.define(this.args[i]['value'], args[i]);
    };
    
    this.parser.load(this.body);
    this.parser.parse();
  };
};