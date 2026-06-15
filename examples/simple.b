// Simple test
number $age = 25;
string $name = "Bantu";
print $name;
print $age;

def greet($name) {
    print "Hello, " + $name + "!";
    return true;
}

greet("World");

for ($i = 0; $i < 5; $i++) {
    print "Count: " + str($i);
}
