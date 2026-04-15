import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // For Android emulator: 10.0.2.2
  // For real Android devices/iOS: use computer's IP address
  static const String _baseUrl = 'http://10.30.4.129:5000/api';

  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    String? userType,
  }) async {
    final uri = Uri.parse('$_baseUrl/auth/login');

    final sanitizedIdentifier = identifier.trim();

    final body = jsonEncode({
      'identifier': sanitizedIdentifier,
      'password': password,
      if (userType != null) 'userType': userType,
    });

    print('🔍 Login Request:');
    print('URL: $uri');
    print('Body: $body');

    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    print('📡 Response Status: ${response.statusCode}');
    print('📡 Response Body: ${response.body}');

    final json = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200 && json['success'] == true) {
      print('✅ Login successful');
      return json;
    }

    print('❌ Login failed: ${json['message']}');
    throw ApiException(
      statusCode: response.statusCode,
      message: json['message'] ?? 'Login failed',
    );
  }

  static Future<Map<String, dynamic>> signup({
    required String name,
    required String email,
    required String phone,
    required String userType,
    required String wardNo,
    required String division,
    required String district,
    required String upazila,
    required String unionName,
    required String ward,
  }) async {
    final uri = Uri.parse('$_baseUrl/auth/signup');
    final body = jsonEncode({
      'userType': userType,
      'name': name,
      'email': email,
      'phone': phone,
      'wardNo': wardNo,
      'division': division,
      'district': district,
      'upazila': upazila,
      'unionName': unionName,
      'ward': ward,
    });

    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 201 && json['success'] == true) {
      return json;
    }

    throw ApiException(
      statusCode: response.statusCode,
      message: json['message'] ?? 'Signup failed',
    );
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}