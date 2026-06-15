// Bantu Language - Functions and Types

// Variable declarations
number $age = 25;
string $name = "Silivestir";
bool $is_developer = true;
list $languages = ["Bantu", "Python", "C++"];
dict $person = {
    "name": "Silivestir",
    "age": 25,
    "country": "Tanzania"
};

// Print variables
print $name;
print $age;
print $person;

// Function definition
def greet($name) {
    print "Hello, " + $name + "!";
    return true;
}

greet("World");
greet("Bantu");

// Function with calculation
def fibonacci($n) {
    if ($n <= 1) {
        return $n;
    }
    return fibonacci($n - 1) + fibonacci($n - 2);
}

print "Fibonacci(10) = " + str(fibonacci(10));

// List operations
each ($lang in $languages) {
    print "Language: " + $lang;
}

// For loop
for ($i = 0; $i < 5; $i++) {
    print "Count: " + str($i);
}

// While loop
number $count = 0;
while ($count < 3) {
    print "While count: " + str($count);
    $count = $count + 1;
}

// Try-catch
try {
    print "Trying something...";
} catch ($e) {
    print "Error: " + $e;
}

// Type checking
print type($name);
print type($age);
print type($is_developer);
print type($languages);
