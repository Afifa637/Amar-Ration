import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String _baseUrl = 'http://localhost:5000/api';

  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final uri = Uri.parse('$_baseUrl/auth/login');

    final sanitizedIdentifier = identifier.trim();
    final isPhone = RegExp(r'^01\d{9}$').hasMatch(sanitizedIdentifier);

    final body = jsonEncode({
      if (!isPhone) 'email': sanitizedIdentifier,
      if (isPhone) 'phone': sanitizedIdentifier,
      'password': password,
    });

    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: body,
    );

    final json = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode == 200 && json['success'] == true) {
      return json;
    }

    throw ApiException(
      statusCode: response.statusCode,
      message: json['message'] ?? 'Login failed',
    );
  }

  static Future<Map<String, dynamic>> signup({
    required String name,
    required String email,
    required String phone,
    required String password,
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
      'password': password,
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
