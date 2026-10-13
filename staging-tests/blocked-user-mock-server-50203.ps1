$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:50203/')
$listener.Start()
$body = '{"status":"Blocked","canUse":false,"registrationCode":"KD-Z2G94-WYXBY","companyName":"\u039a\u039f\u03a4\u03a3\u039f\u03a1\u0393\u0399\u039f\u03a3 \u03a0\u0391\u039d\u0391\u0393\u0399\u03a9\u03a4\u0397\u03a3","daysRemaining":0,"warningDays":0,"annualPrice":0,"currency":"EUR","paymentUrl":"https://mykalypsis.gr/contact","message":"\u0397 \u03c0\u03c1\u03cc\u03c3\u03b2\u03b1\u03c3\u03b7 \u03ad\u03c7\u03b5\u03b9 \u03b1\u03c0\u03bf\u03ba\u03bb\u03b5\u03b9\u03c3\u03c4\u03b5\u03af \u03b1\u03c0\u03cc \u03c4\u03bf\u03bd \u03b4\u03b9\u03b1\u03c7\u03b5\u03b9\u03c1\u03b9\u03c3\u03c4\u03ae \u03c4\u03bf\u03c5 Kalypsis."}'
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes($body)
            $context.Response.StatusCode = 200
            $context.Response.ContentType = 'application/json; charset=utf-8'
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        finally { $context.Response.Close() }
    }
}
finally { $listener.Stop(); $listener.Close() }
