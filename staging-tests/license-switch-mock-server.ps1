$flag = 'G:\\KalypsisDesktop-TerminationDemo-20261012\\data\\admin-terminated.flag'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:50202/')
$listener.Start()
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if (Test-Path -LiteralPath $flag) {
                $body = '{"status":"Blocked","canUse":false,"registrationCode":"KD-TERM-TEST-2026","companyName":"Demo Office","daysRemaining":0,"warningDays":0,"annualPrice":0,"currency":"EUR","paymentUrl":"https://mykalypsis.gr/contact","message":"Η πρόσβαση τερματίστηκε από τον διαχειριστή του Kalypsis."}'
            }
            else {
                $body = '{"status":"Active","canUse":true,"registrationCode":"KD-TERM-TEST-2026","companyName":"Demo Office","daysRemaining":365,"warningDays":20,"annualPrice":0,"currency":"EUR","paymentUrl":"https://mykalypsis.gr/contact","message":"Η άδεια είναι ενεργή."}'
            }
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
