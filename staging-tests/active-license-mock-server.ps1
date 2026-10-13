$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:50200/')
$listener.Start()
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $body = '{"status":"Active","canUse":true,"registrationCode":"KD-UI5-TEST-2026","companyName":"Demo Office","daysRemaining":365,"warningDays":20,"annualPrice":0,"currency":"EUR","paymentUrl":"https://mykalypsis.gr/contact","message":"License active for connection test."}'
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
