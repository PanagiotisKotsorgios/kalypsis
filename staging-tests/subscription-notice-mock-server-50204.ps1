$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:50204/')
$listener.Start()
$body = '{"status":"Expiring","canUse":true,"registrationCode":"KD-Z2G94-WYXBY","companyName":"\u039a\u039f\u03a4\u03a3\u039f\u03a1\u0393\u0399\u039f\u03a3 \u03a0\u0391\u039d\u0391\u0393\u0399\u03a9\u03a4\u0397\u03a3","daysRemaining":20,"warningDays":30,"annualPrice":1466,"currency":"EUR","paymentUrl":"https://mykalypsis.gr/contact","message":"\u0397 \u03c3\u03c5\u03bd\u03b4\u03c1\u03bf\u03bc\u03ae \u03c3\u03b1\u03c2 \u03bb\u03ae\u03b3\u03b5\u03b9 \u03c3\u03cd\u03bd\u03c4\u03bf\u03bc\u03b1."}'
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
