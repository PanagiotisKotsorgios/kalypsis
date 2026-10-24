using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Mail;
using System.Text.RegularExpressions;
namespace Kalypsis.Claims;
public static class ClaimDossierRules
{
    public const long MaxFileBytes=20*1024*1024;
    public static readonly (string Code,string Name)[] LegacyKinds=[("VehicleDamage","Ζημιά οχήματος"),("ThirdPartyLiability","Ζημιά τρίτου"),("Theft","Κλοπή"),("WaterDamage","Πλημμύρα / νερά"),("Fire","Πυρκαγιά"),("Other","Άλλο")];
    public static readonly (string Code,string Name)[] DocumentKinds=[("Photo","Φωτογραφία"),("AccidentStatement","Δήλωση ατυχήματος"),("PoliceReport","Αστυνομική αναφορά"),("RepairEstimate","Προσφορά επισκευής"),("Invoice","Τιμολόγιο / απόδειξη"),("MedicalReport","Ιατρικό έγγραφο"),("Other","Άλλο δικαιολογητικό")];
    public static string Branch(string? value)=>value?.Trim() switch{"Motor"=>"Auto","Property"=>"Home",null=>"",var text=>text};
    public static string BranchLabel(string? code)=>Branch(code) switch{""=>"Όλοι οι κλάδοι","Auto"=>"Αυτοκίνητο","Home"=>"Κατοικία","Health"=>"Υγεία","Life"=>"Ζωή","Business"=>"Επιχείρηση","Travel"=>"Ταξίδι","Marine"=>"Σκάφη","Cargo"=>"Μεταφορές","LiabilityGeneral"=>"Αστική ευθύνη","Personal"=>"Προσωπικό ατύχημα","Other"=>"Άλλος κλάδος",var value=>value};
    public static string? FieldError(string key,string? value)
    {
        if(string.IsNullOrWhiteSpace(value)||value=="—")return null;
        if(value.Length>(key is "DamageDescription"?4000:300))return "Το κείμενο είναι πολύ μεγάλο.";
        if(key.EndsWith("Email")&&!MailAddress.TryCreate(value,out _))return "Συμπληρώστε έγκυρο email.";
        if(key.EndsWith("Phone")&&!Regex.IsMatch(value,@"^[+0-9 ()-]{7,40}$"))return "Συμπληρώστε έγκυρο τηλέφωνο.";
        if(key=="IncidentTime"&&!TimeOnly.TryParseExact(value,"HH:mm",CultureInfo.InvariantCulture,DateTimeStyles.None,out _))return "Η ώρα πρέπει να έχει μορφή ΩΩ:ΛΛ (00:00–23:59).";
        return null;
    }
    public static string FileName(string raw)
    {
        var name=Path.GetFileName(raw.Replace('\\','/')).Trim();
        if(name.Length==0||name.Length>200||name.Any(char.IsControl))throw new ArgumentException("Μη έγκυρο όνομα αρχείου.");return name;
    }
    public static string ValidateFile(string fileName,long length,byte[] header)
    {
        if(length<=0||length>MaxFileBytes)throw new ArgumentException("Επιλέξτε αρχείο έως 20 MB.");
        var extension=Path.GetExtension(FileName(fileName)).ToLowerInvariant();
        bool Starts(params byte[] bytes)=>header.Length>=bytes.Length&&header.AsSpan(0,bytes.Length).SequenceEqual(bytes);
        // Implemented without accepting the browser-provided Content-Type as evidence.
        if(extension==".pdf"&&Starts(0x25,0x50,0x44,0x46,0x2D))return "application/pdf";
        if(extension is ".jpg" or ".jpeg"&&Starts(0xFF,0xD8,0xFF))return "image/jpeg";
        if(extension==".png"&&Starts(0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A))return "image/png";
        if(extension==".webp"&&Starts(0x52,0x49,0x46,0x46)&&header.Length>=12&&header.AsSpan(8,4).SequenceEqual(new byte[]{0x57,0x45,0x42,0x50}))return "image/webp";
        if(extension==".docx"&&Starts(0x50,0x4B,0x03,0x04))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if(extension==".xlsx"&&Starts(0x50,0x4B,0x03,0x04))return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if(extension==".txt"&&!header.Contains((byte)0)&&!Starts(0x4D,0x5A))return "text/plain";
        throw new ArgumentException("Επιτρέπονται PDF, JPG, PNG, WEBP, DOCX, XLSX και TXT με αντίστοιχο περιεχόμενο.");
    }
}
