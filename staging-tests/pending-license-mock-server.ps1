$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:50199/')
$listener.Start()

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $body = @{
                status = 'PendingPayment'
                canUse = $false
                registrationCode = 'KD-DTFW-9S2CJ'
                companyName = 'Demo Office'
                accessStartsAtUtc = $null
                accessExpiresAtUtc = $null
                daysRemaining = $null
                warningDays = 20
                annualPrice = 0
                currency = 'EUR'
                paymentUrl = 'https://mykalypsis.gr/contact'
                message = 'Registration received and waiting for administrator approval.'
            } | ConvertTo-Json -Compress

            $bytes = [Text.Encoding]::UTF8.GetBytes($body)
            $context.Response.StatusCode = 200
            $context.Response.ContentType = 'application/json; charset=utf-8'
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        finally {
            $context.Response.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
