import 'package:amar_ration_app/qr_scanner_screen.dart';
import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'আমার রেশন',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1f77b4)),
        fontFamily: 'Anek Bangla',
        useMaterial3: false,
      ),
      home: const SplashScreen(),
    );
  }
}
