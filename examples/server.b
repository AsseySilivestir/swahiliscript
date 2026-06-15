// Bantu Language - Server Example using sua framework

def handleHome($request) {
    print "Home page requested";
    return "Welcome to Bantu Server!";
}

def handleAPI($request) {
    dict $response = {
        "status": "ok",
        "language": "Bantu",
        "version": "1.0.0"
    };
    return $response;
}

print "Starting Bantu Server...";
print "Routes defined with sua framework";
print "Server would run on port 3000";
