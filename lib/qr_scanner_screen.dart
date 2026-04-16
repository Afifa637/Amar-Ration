import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'consumer_details_screen.dart';

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({Key? key}) : super(key: key);

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  late MobileScannerController _cameraController;
  bool _hasScanned = false;

  @override
  void initState() {
    super.initState();
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    _cameraController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasScanned) return;

    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final rawPayload = barcode.rawValue!.trim();
    if (rawPayload.isEmpty) return;

    setState(() => _hasScanned = true);

    final parsed = _parseArQrPayload(rawPayload);

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => ConsumerDetailsScreen(
          rawPayload: rawPayload,
          parsedData: parsed,
        ),
      ),
    );
  }

  /// Parse QR payload: ARC:consumerCode:ward:category:expiryYYYYMMDD:hmac
  Map<String, String>? _parseArQrPayload(String raw) {
    final parts = raw.split(':');
    if (parts.length != 6) return null;
    if (parts[0] != 'ARC') return null;

    final consumerCode = parts[1].trim();
    final ward = parts[2].trim();
    final category = parts[3].trim().toUpperCase();
    final expiryYMD = parts[4].trim();
    final hmac = parts[5].trim().toLowerCase();

    if (consumerCode.isEmpty) return null;
    if (!RegExp(r'^\d{2}$').hasMatch(ward)) return null;
    if (!RegExp(r'^[ABC]$').hasMatch(category)) return null;
    if (!RegExp(r'^\d{8}$').hasMatch(expiryYMD)) return null;
    if (!RegExp(r'^[a-f0-9]{8}$').hasMatch(hmac)) return null;

    final year = int.tryParse(expiryYMD.substring(0, 4)) ?? 0;
    final month = int.tryParse(expiryYMD.substring(4, 6)) ?? 0;
    final day = int.tryParse(expiryYMD.substring(6, 8)) ?? 0;
    final expiryDate = DateTime(year, month, day, 23, 59, 59);
    final expired = DateTime.now().isAfter(expiryDate);

    return {
      'consumerCode': consumerCode,
      'ward': ward,
      'category': category,
      'expiryDate': '$day/$month/$year',
      'expiryRaw': expiryYMD,
      'hmac': hmac,
      'expired': expired.toString(),
      'rawPayload': raw,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'QR স্কেনার',
          style: TextStyle(
            fontFamily: 'Anek Bangla',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: _cameraController.torchState,
              builder: (context, state, child) {
                return Icon(
                  state == TorchState.on ? Icons.flash_on : Icons.flash_off,
                  color: state == TorchState.on
                      ? const Color(0xFFFFC107)
                      : Colors.white,
                );
              },
            ),
            onPressed: () => _cameraController.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch, color: Colors.white),
            onPressed: () => _cameraController.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Live camera preview
          MobileScanner(
            controller: _cameraController,
            onDetect: _onDetect,
          ),

          // Scan overlay with cutout
          _buildScanOverlay(),

          // Top instruction
          Positioned(
            top: 20,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'গ্রাহকের রেশন কার্ডের QR কোড স্কেন করুন',
                style: TextStyle(
                  fontFamily: 'Anek Bangla',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),

          // Bottom hint
          Positioned(
            bottom: 40,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.6),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'QR কোড ফ্রেমের ভিতরে রাখুন',
                style: TextStyle(
                  fontFamily: 'Anek Bangla',
                  fontSize: 13,
                  color: Colors.white70,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScanOverlay() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final scanSize = constraints.maxWidth * 0.7;
        final left = (constraints.maxWidth - scanSize) / 2;
        final top = (constraints.maxHeight - scanSize) / 2.5;

        return Stack(
          children: [
            // Dark mask with transparent cutout
            ColorFiltered(
              colorFilter: ColorFilter.mode(
                Colors.black.withOpacity(0.5),
                BlendMode.srcOut,
              ),
              child: Stack(
                children: [
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.black,
                      backgroundBlendMode: BlendMode.dstOut,
                    ),
                  ),
                  Positioned(
                    left: left,
                    top: top,
                    child: Container(
                      width: scanSize,
                      height: scanSize,
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Corner brackets
            Positioned(
              left: left,
              top: top,
              child: _buildCornerBrackets(scanSize),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCornerBrackets(double size) {
    const len = 30.0;
    const w = 4.0;
    const c = Color(0xFF28a745);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          // Top-left
          Positioned(left: 0, top: 0, child: _corner(c, len, w, tl: true)),
          // Top-right
          Positioned(right: 0, top: 0, child: _corner(c, len, w, tr: true)),
          // Bottom-left
          Positioned(left: 0, bottom: 0, child: _corner(c, len, w, bl: true)),
          // Bottom-right
          Positioned(right: 0, bottom: 0, child: _corner(c, len, w, br: true)),
        ],
      ),
    );
  }

  Widget _corner(Color color, double len, double w,
      {bool tl = false, bool tr = false, bool bl = false, bool br = false}) {
    return SizedBox(
      width: len,
      height: len,
      child: CustomPaint(
        painter: _CornerPainter(color: color, strokeWidth: w, tl: tl, tr: tr, bl: bl, br: br),
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final bool tl, tr, bl, br;

  _CornerPainter({
    required this.color,
    required this.strokeWidth,
    this.tl = false,
    this.tr = false,
    this.bl = false,
    this.br = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    if (tl) {
      canvas.drawLine(const Offset(0, 0), Offset(size.width, 0), paint);
      canvas.drawLine(const Offset(0, 0), Offset(0, size.height), paint);
    }
    if (tr) {
      canvas.drawLine(Offset(0, 0), Offset(size.width, 0), paint);
      canvas.drawLine(Offset(size.width, 0), Offset(size.width, size.height), paint);
    }
    if (bl) {
      canvas.drawLine(Offset(0, size.height), Offset(size.width, size.height), paint);
      canvas.drawLine(const Offset(0, 0), Offset(0, size.height), paint);
    }
    if (br) {
      canvas.drawLine(Offset(0, size.height), Offset(size.width, size.height), paint);
      canvas.drawLine(Offset(size.width, 0), Offset(size.width, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
