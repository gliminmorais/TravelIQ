"""Generate only fictional ticket fixtures. Never copy customer documents into public/."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'public'/'samples'
DEST.mkdir(parents=True,exist_ok=True)
fixtures=[
 ('single-ticket.pdf','NORTHSTAR AIR | E-TICKET',[
 'Booking Reference: DEMO01','Passenger: Maya Example','Ticket Number: 000-1234567890',
 'Booking Date: 2026-10-01','Segment 1:','Airline: Northstar Air','Flight Number: NS 101',
 'Origin: BOM','Destination: DXB','Departure: 2026-11-15 09:30','Arrival: 2026-11-15 11:20','Ticket Fare: INR 25000.00'],
 {'pnr':'DEMO01','passengers':[{'name':'Maya Example','ticketNumber':'000-1234567890'}],'segments':[{'airline':'Northstar Air','flightNumber':'NS 101','origin':'BOM','destination':'DXB','departure':'2026-11-15T09:30','arrival':'2026-11-15T11:20'}]}),
 ('multi-ticket.pdf','BLUE HORIZON | RETURN ITINERARY',[
 'PNR: DEMO02','Passenger 1: Arjun Fiction','Ticket Number: 000-2234567890','Passenger 2: Tara Fiction','Ticket Number: 000-2234567891',
 'Segment 1:','Airline: Blue Horizon','Flight: BH 205','From: DEL','To: SIN','Departure: 2026-11-20 08:45','Arrival: 2026-11-20 17:00',
 'Segment 2:','Airline: Blue Horizon','Flight: BH 206','From: SIN','To: DEL','Departure: 2026-11-27 18:00','Arrival: 2026-11-27 21:20','Total Fare: INR 92000.00'],
 {'pnr':'DEMO02','passengers':[{'name':'Arjun Fiction','ticketNumber':'000-2234567890'},{'name':'Tara Fiction','ticketNumber':'000-2234567891'}],'segments':[{'airline':'Blue Horizon','flightNumber':'BH 205','origin':'DEL','destination':'SIN','departure':'2026-11-20T08:45','arrival':'2026-11-20T17:00'},{'airline':'Blue Horizon','flightNumber':'BH 206','origin':'SIN','destination':'DEL','departure':'2026-11-27T18:00','arrival':'2026-11-27T21:20'}]}),
 ('alternate-ticket.pdf','SKYLINE TRAVEL | CONFIRMATION',[
 'Record Locator: DEMO03','Traveller: Leela Sample','Booking Date: 2026-10-03','Leg 1:',
 'Carrier: Skyline Air','Flight No: SL 401','From: BLR','To: GOI','Departs: 2026-12-02 14:10','Agency Cost: INR 99999.00','Customer Charged: INR 99999.00'],
 {'pnr':'DEMO03','passengers':[{'name':'Leela Sample','ticketNumber':''}],'segments':[{'airline':'Skyline Air','flightNumber':'SL 401','origin':'BLR','destination':'GOI','departure':'2026-12-02T14:10','arrival':''}]})
]
fixtures.extend([
 ('agency-table-ticket.pdf','FICTIONAL AGENCY | CONNECTING ITINERARY',[
 'M PNR *MASTER1*','Issued on : 02 January 2027','Airline PNR : *DEMO04*',
 'Onward Flight','Airline Origin Destination Dep.Date & Time Arr.Date & Time',
 '6E-1001','Bengaluru, India Chennai, India 12-Jan-2027, 13:15 12-Jan-2027, 14:35',
 'Airline Origin Destination Dep.Date & Time Arr.Date & Time','6E-1002',
 'Chennai, India Hyderabad, India 12-Jan-2027, 17:15 12-Jan-2027, 18:10',
 'Passenger Name Type Ticket No. Class','MR DEV FICTION (Onward)','Adult 00000001 X',
 'FreeCheckInBaggage:-15KG [BLR-MAA]','FreeCheckInBaggage:-15KG [MAA-HYD]',
 'Fare Information','Gross Fare: 12345.00'],
 {'pnr':'DEMO04','passengers':[{'name':'DEV FICTION','ticketNumber':'00000001'}],'segments':[{'airline':'IndiGo','flightNumber':'6E 1001','origin':'BLR','destination':'MAA','departure':'2027-01-12T13:15','arrival':'2027-01-12T14:35'},{'airline':'IndiGo','flightNumber':'6E 1002','origin':'MAA','destination':'HYD','departure':'2027-01-12T17:15','arrival':'2027-01-12T18:10'}]}),
 ('agency-card-ticket.pdf','FICTIONAL AGENCY | FLIGHT CONFIRMATION',[
 'CONFIRMED','Airline PNR DEMO05','R PNR: SUPPLIER05','Issued Date: 02/01/2027',
 'Passengers Ticket Numbers','Mr. Rohan / Example (Adult) 00000005','Your Flight',
 'Onward - Kochi To Dubai 21 Jan 2027','Jan 21, 08:20','Kochi','COK','Terminal - 1',
 'Flight No IX 100 | Fare Basis - EXAMPLE','Operated by Air India Express - IX',
 'Jan 21, 11:05','Dubai','DXB','Terminal - 2','Seat Reservations','Gross Amount: 21000'],
 {'pnr':'DEMO05','passengers':[{'name':'Rohan Example','ticketNumber':'00000005'}],'segments':[{'airline':'Air India Express','flightNumber':'IX 100','origin':'COK','destination':'DXB','departure':'2027-01-21T08:20','arrival':'2027-01-21T11:05'}]})
])
expected=[]
fixtures.append(('indigo-itinerary-ticket.pdf','INDIGO | FICTIONAL ITINERARY',[
 'Passenger Information','MRS MAYA EXAMPLE Adult','MSTR ARJUN EXAMPLE Child','MISS TARA EXAMPLE Child',
 'Sector Seat Services Purchased','BOM - DXB - -','Departing','Check-in/Bag drop closes: 00:05 hrs',
 'BOM - Mumbai International Airport','(Terminal 2)','01:20, 15 Nov 2026',
 'DXB - Dubai International Airport','03:55, 15 Nov 2026',
 'PNR / Booking Ref DEMO06 Confirmed Payment status Complete','6E 1234 . A320','Baggage Information'],
 {'pnr':'DEMO06','passengers':[{'name':'MAYA EXAMPLE','ticketNumber':''},{'name':'ARJUN EXAMPLE','ticketNumber':''},{'name':'TARA EXAMPLE','ticketNumber':''}],
 'segments':[{'airline':'IndiGo','flightNumber':'6E 1234','origin':'BOM','destination':'DXB','departure':'2026-11-15T01:20','arrival':'2026-11-15T03:55'}]}))
for filename,title,lines,fields in fixtures:
 contact={'single-ticket.pdf':'+91 00000 10001','multi-ticket.pdf':'+91 00000 10002','agency-table-ticket.pdf':'0000010004','agency-card-ticket.pdf':'0000010005'}.get(filename,'')
 lines.insert(1,'Agency Phone: +91 00000 99999')
 if contact: lines.insert(2,('Passenger Contact Number - ' if filename=='agency-card-ticket.pdf' else 'Customer Phone No: ')+contact)
 fields['customerPhone']=contact
 c=canvas.Canvas(str(DEST/filename),pagesize=(595,842))
 c.setTitle('TravelIQ fictional test ticket')
 c.setFillColor(HexColor('#152039'));c.rect(0,728,595,114,fill=1,stroke=0)
 c.setFillColor(HexColor('#ffffff'));c.setFont('Helvetica-Bold',21);c.drawString(42,790,'TravelIQ / sample ticket')
 c.setFont('Helvetica',11);c.drawString(42,762,title)
 c.setFillColor(HexColor('#687ca4'));c.setFont('Helvetica-Bold',9);c.drawString(42,697,'FICTIONAL DOCUMENT - NOT VALID FOR TRAVEL')
 y=661
 for line in lines:
  c.setFillColor(HexColor('#273449'));c.setFont('Helvetica-Bold' if line.startswith(('Segment','Leg')) else 'Helvetica',11)
  c.drawString(42,y,line);y-=22
 c.setStrokeColor(HexColor('#dde4ed'));c.line(42,91,553,91)
 c.setFont('Helvetica',9);c.setFillColor(HexColor('#738299'));c.drawString(42,69,'Synthetic extraction fixture. All people, references and flights are fictional.')
 c.drawString(42,53,'Fare lines must never populate Agency Cost or Customer Charged.');c.save()
 expected.append({'file':filename,'expected':fields})
(DEST/'expected.json').write_text(json.dumps(expected,indent=2)+'\n',encoding='utf8')
print(f'Generated {len(fixtures)} fictional PDF fixtures.')
