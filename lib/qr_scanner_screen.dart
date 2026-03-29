import 'package:flutter/material.dart';
import 'consumer_details_screen.dart';

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({Key? key}) : super(key: key);

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  bool _torchOn = false;
  bool _isScanning = false;

  void _simulateQRScan() {
    setState(() {
      _isScanning = true;
    });

    // Simulate QR scan delay
    Future.delayed(const Duration(seconds: 2), () {
      if (!mounted) return;

      // Simulate different outcomes (randomly)
      final outcomes = [
        {
          'status': 'eligible',
          'consumerName': 'রহিম আহমেদ',
          'consumerPhone': '01712345678',
        },
        {
          'status': 'not_registered',
          'consumerName': 'অজানা গ্রাহক',
          'consumerPhone': 'N/A',
        },
        {
          'status': 'not_eligible',
          'consumerName': 'ফাতিমা বেগম',
          'consumerPhone': '01987654321',
          'lastCollection': '২৮ মার্চ ২০২৬',
        },
      ];

      final random = outcomes[DateTime.now().millisecond % outcomes.length];

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ConsumerDetailsScreen(
            status: random['status'] as String,
            consumerName: random['consumerName'] as String,
            consumerPhone: random['consumerPhone'] as String,
            lastCollection: random['lastCollection'] as String?,
          ),
        ),
      );

      setState(() {
        _isScanning = false;
      });
    });
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
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      body: Stack(
        children: [
          // Camera Preview (Mock)
          Container(
            color: Colors.black,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 300,
                    height: 300,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Colors.grey[700]!,
                        width: 2,
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(
                          Icons.camera_alt,
                          size: 60,
                          color: Colors.grey,
                        ),
                        SizedBox(height: 16),
                        Text(
                          'ক্যামেরা',
                          style: TextStyle(
                            color: Colors.grey,
                            fontFamily: 'Anek Bangla',
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Scanning Frame Overlay
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 280,
                  height: 280,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: const Color(0xFFdc3545),
                      width: 3,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ],
            ),
          ),

          // Instructions and Controls
          Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top Instructions
              Padding(
                padding: const EdgeInsets.only(top: 20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  child: const Text(
                    'গ্রাহক কার্ড স্কেন করুন',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),

              // Bottom Controls
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Torch Button
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _torchOn
                            ? const Color(0xFFFFC107)
                            : Colors.grey[700],
                      ),
                      child: IconButton(
                        icon: Icon(
                          _torchOn ? Icons.flash_on : Icons.flash_off,
                          color: Colors.white,
                          size: 28,
                        ),
                        onPressed: () {
                          setState(() {
                            _torchOn = !_torchOn;
                          });
                        },
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Scan Button or Loading
                    if (_isScanning)
                      SizedBox(
                        width: 60,
                        height: 60,
                        child: CircularProgressIndicator(
                          strokeWidth: 4,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    else
                      GestureDetector(
                        onTap: _simulateQRScan,
                        child: Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF28a745),
                          ),
                          child: const Icon(
                            Icons.camera,
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),

                    // Cancel Button
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.grey[700],
                      ),
                      child: IconButton(
                        icon: const Icon(
                          Icons.close,
                          color: Colors.white,
                          size: 28,
                        ),
                        onPressed: () {
                          Navigator.pop(context);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
