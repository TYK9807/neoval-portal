import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMoney(n: number) {
  const p = (Math.round((n || 0) * 100) / 100).toFixed(2).split('.')
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return p[0] + ',' + p[1] + ' MAD'
}

// Ported 1:1 from Mes documents.html's client-side generatePDF() so server-generated
// documents are visually identical to ones a pharmacy would generate by clicking download.
function generatePDF(type: 'BL' | 'POP', order: any, shortIdFull: string, pharmacyName: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const isbl = type === 'BL'
  const title = isbl ? 'BON DE LIVRAISON' : 'PREUVE DE PAIEMENT'
  const dateVal = isbl ? (order.confirmed_at || order.created_at) : (order.delivered_at || order.created_at)
  const CONTENT_BOTTOM = 265

  function drawFooter() {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(160, 160, 160)
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.2)
    pdf.line(14, 280, 196, 280)
    pdf.text('Neoval Pharma — Document généré automatiquement via le portail B2B', 14, 286)
    pdf.text('Ce document est valide sans signature.', 196, 286, { align: 'right' })
  }

  function drawPageHeader(isFirst: boolean) {
    pdf.setFillColor(13, 191, 168)
    pdf.rect(0, 0, 210, 22, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(255, 255, 255)
    pdf.text('NEOVAL PHARMA', 14, 10)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text('PORTAIL B2B — DOCUMENT OFFICIEL', 14, 17)
    pdf.setTextColor(220, 252, 248)
    pdf.text(new Date().toLocaleDateString('fr-FR'), 196, 10, { align: 'right' })

    if (isFirst) {
      pdf.setTextColor(13, 27, 42)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(22)
      pdf.text(title, 14, 40)
      pdf.setDrawColor(13, 191, 168)
      pdf.setLineWidth(0.5)
      pdf.line(14, 44, 196, 44)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(60, 70, 80)
      pdf.text('Référence:', 14, 54)
      pdf.setFont('helvetica', 'bold')
      pdf.text(shortIdFull, 50, 54)
      pdf.setFont('helvetica', 'normal')
      pdf.text('Date:', 14, 62)
      pdf.setFont('helvetica', 'bold')
      pdf.text(fmtDate(dateVal), 50, 62)
      let sy = 74
      if (pharmacyName) {
        pdf.setFont('helvetica', 'normal')
        pdf.text('Pharmacie:', 14, 70)
        pdf.setFont('helvetica', 'bold')
        pdf.text(pharmacyName, 50, 70)
        sy = 82
      }
      return sy
    } else {
      pdf.setTextColor(13, 27, 42)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text(title + ' — suite', 14, 36)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(60, 70, 80)
      pdf.text(shortIdFull, 14, 44)
      if (pharmacyName) pdf.text('· ' + pharmacyName, 50, 44)
      pdf.setDrawColor(13, 191, 168)
      pdf.setLineWidth(0.3)
      pdf.line(14, 48, 196, 48)
      return 58
    }
  }

  function drawTableHeader(y: number) {
    pdf.setFillColor(240, 244, 248)
    pdf.rect(14, y - 5, 182, 9, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(40, 50, 65)
    pdf.text('PRODUIT', 17, y)
    pdf.text('QTÉ', 128, y, { align: 'right' })
    pdf.text('PRIX UNIT.', 160, y, { align: 'right' })
    pdf.text('SOUS-TOTAL', 195, y, { align: 'right' })
    return y + 10
  }

  let startY = drawPageHeader(true)
  drawFooter()

  if (isbl) {
    const items = order.order_items || []
    if (items.length) {
      let y = drawTableHeader(startY)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9.5)
      let rowIndex = 0

      items.forEach((item: any) => {
        const pname = (item.products && item.products.name) ? item.products.name : 'Produit'
        const sub = (item.quantity || 0) * (item.unit_price || 0)

        if (y + 9 + 13 > CONTENT_BOTTOM) {
          pdf.addPage()
          startY = drawPageHeader(false)
          drawFooter()
          y = drawTableHeader(startY)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9.5)
          rowIndex = 0
        }

        if (rowIndex % 2 === 1) { pdf.setFillColor(250, 251, 252); pdf.rect(14, y - 5, 182, 8, 'F') }
        pdf.setTextColor(13, 27, 42)
        pdf.text(String(pname).slice(0, 55), 17, y)
        pdf.setTextColor(60, 70, 80)
        pdf.text(String(item.quantity || 0), 128, y, { align: 'right' })
        pdf.text(fmtMoney(item.unit_price), 160, y, { align: 'right' })
        pdf.text(fmtMoney(sub), 195, y, { align: 'right' })
        y += 9
        pdf.setDrawColor(220, 225, 230)
        pdf.setLineWidth(0.2)
        pdf.line(14, y - 4, 196, y - 4)
        rowIndex++
      })

      y += 4
      pdf.setFillColor(13, 27, 42)
      pdf.rect(130, y - 5, 66, 9, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9.5)
      pdf.setTextColor(255, 255, 255)
      pdf.text('TOTAL', 135, y)
      pdf.text(fmtMoney(order.total), 195, y, { align: 'right' })
    }
  } else {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(60, 70, 80)
    pdf.text('Ce document certifie la réception et le paiement de la commande ' + shortIdFull + '.', 14, startY)
    const y2 = startY + 18
    pdf.setFillColor(240, 254, 250)
    pdf.setDrawColor(13, 191, 168)
    pdf.setLineWidth(0.4)
    pdf.roundedRect(14, y2 - 6, 182, 28, 2, 2, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(13, 100, 90)
    pdf.text('Montant total réglé', 24, y2 + 4)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(20)
    pdf.setTextColor(13, 191, 168)
    pdf.text(fmtMoney(order.total), 24, y2 + 16)
  }

  return new Uint8Array(pdf.output('arraybuffer'))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { order_id, type } = await req.json()
    if (!order_id || !type) throw new Error('Missing order_id or type')
    if (type !== 'BL' && type !== 'POP') throw new Error('type must be BL or POP')

    const shortId = String(order_id).slice(0, 8).toUpperCase()
    const shortIdFull = 'CMD-' + shortId
    const storagePath = `${order_id}/${type}-${shortId}.pdf`

    // Idempotent: if already generated (e.g. webhook retry), serve the existing file
    // instead of regenerating, matching the client page's fileUrl-exists shortcut.
    const { data: existingDoc } = await adminClient
      .from('documents').select('file_url').eq('order_id', order_id).eq('type', type).maybeSingle()

    let pdfBytes: Uint8Array

    if (existingDoc?.file_url) {
      const { data: fileBlob, error: downloadErr } = await adminClient.storage
        .from('documents').download(existingDoc.file_url)
      if (downloadErr) throw downloadErr
      pdfBytes = new Uint8Array(await fileBlob.arrayBuffer())
    } else {
      const { data: order, error: orderErr } = await adminClient
        .from('orders')
        .select('id,created_at,total,confirmed_at,delivered_at,pharmacy_id,order_items(quantity,unit_price,products(name))')
        .eq('id', order_id).single()
      if (orderErr || !order) throw new Error('Order not found')

      let pharmacyName = ''
      if (order.pharmacy_id) {
        const { data: pharmacy } = await adminClient
          .from('pharmacies').select('name').eq('id', order.pharmacy_id).maybeSingle()
        pharmacyName = pharmacy?.name || ''
      }

      pdfBytes = generatePDF(type, order, shortIdFull, pharmacyName)

      const { error: uploadErr } = await adminClient.storage
        .from('documents').upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })
      if (uploadErr && (uploadErr as any).statusCode !== '409') throw uploadErr

      await adminClient.from('documents').upsert(
        { order_id, type, file_url: storagePath },
        { onConflict: 'order_id,type', ignoreDuplicates: true }
      )
    }

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${type}-${shortId}.pdf"`,
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
