/*
 *
 * Copyright (c) 2017-present, Netifi Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

#ifndef RSOCKET_RPC_COMPILER_JS_GENERATOR_HELPERS_H
#define RSOCKET_RPC_COMPILER_JS_GENERATOR_HELPERS_H

#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>
#include <google/protobuf/descriptor.h>
#include <google/protobuf/descriptor.pb.h>

using namespace std;

namespace rsocket_rpc_js_generator {

inline bool StripSuffix(string* filename, const string& suffix) {
  if (filename->length() >= suffix.length()) {
    size_t suffix_pos = filename->length() - suffix.length();
    if (filename->compare(suffix_pos, string::npos, suffix) == 0) {
      filename->resize(filename->size() - suffix.size());
      return true;
    }
  }

  return false;
}

inline bool StripPrefix(string* name, const string& prefix) {
  if (name->length() >= prefix.length()) {
    if (name->substr(0, prefix.size()) == prefix) {
      *name = name->substr(prefix.size());
      return true;
    }
  }
  return false;
}

inline string StripProto(string filename) {
  if (!StripSuffix(&filename, ".protodevel")) {
    StripSuffix(&filename, ".proto");
  }
  return filename;
}

inline string StringReplace(string str, const string& from,
                                  const string& to, bool replace_all) {
  size_t pos = 0;

  do {
    pos = str.find(from, pos);
    if (pos == string::npos) {
      break;
    }
    str.replace(pos, from.length(), to);
    pos += to.length();
  } while (replace_all);

  return str;
}

inline string StringReplace(string str, const string& from,
                                  const string& to) {
  return StringReplace(str, from, to, true);
}

inline std::vector<string> tokenize(const string& input,
                                          const string& delimiters) {
  std::vector<string> tokens;
  size_t pos, last_pos = 0;

  for (;;) {
    bool done = false;
    pos = input.find_first_of(delimiters, last_pos);
    if (pos == string::npos) {
      done = true;
      pos = input.length();
    }

    tokens.push_back(input.substr(last_pos, pos - last_pos));
    if (done) return tokens;

    last_pos = pos + 1;
  }
}

inline string CapitalizeFirstLetter(string s) {
  if (s.empty()) {
    return s;
  }
  s[0] = ::toupper(s[0]);
  return s;
}

inline string LowercaseFirstLetter(string s) {
  if (s.empty()) {
    return s;
  }
  s[0] = ::tolower(s[0]);
  return s;
}

inline string LowerUnderscoreToUpperCamel(string str) {
  std::vector<string> tokens = tokenize(str, "_");
  string result = "";
  for (unsigned int i = 0; i < tokens.size(); i++) {
    result += CapitalizeFirstLetter(tokens[i]);
  }
  return result;
}

inline string FileNameInUpperCamel(
    const google::protobuf::FileDescriptor* file, bool include_package_path) {
  std::vector<string> tokens = tokenize(StripProto(file->name()), "/");
  string result = "";
  if (include_package_path) {
    for (unsigned int i = 0; i < tokens.size() - 1; i++) {
      result += tokens[i] + "/";
    }
  }
  result += LowerUnderscoreToUpperCamel(tokens.back());
  return result;
}

inline string FileNameInUpperCamel(
    const google::protobuf::FileDescriptor* file) {
  return FileNameInUpperCamel(file, true);
}

enum MethodType {
  METHODTYPE_NO_STREAMING,
  METHODTYPE_CLIENT_STREAMING,
  METHODTYPE_SERVER_STREAMING,
  METHODTYPE_BIDI_STREAMING
};

inline MethodType GetMethodType(
    const google::protobuf::MethodDescriptor* method) {
  if (method->client_streaming()) {
    if (method->server_streaming()) {
      return METHODTYPE_BIDI_STREAMING;
    } else {
      return METHODTYPE_CLIENT_STREAMING;
    }
  } else {
    if (method->server_streaming()) {
      return METHODTYPE_SERVER_STREAMING;
    } else {
      return METHODTYPE_NO_STREAMING;
    }
  }
}

inline void Split(const string& s, char delim,
                  std::vector<string>* append_to) {
  std::istringstream iss(s);
  string piece;
  while (std::getline(iss, piece)) {
    append_to->push_back(piece);
  }
}

enum CommentType {
  COMMENTTYPE_LEADING,
  COMMENTTYPE_TRAILING,
  COMMENTTYPE_LEADING_DETACHED
};

// Get all the raw comments and append each line without newline to out.
template <typename DescriptorType>
inline void GetComment(const DescriptorType* desc, CommentType type,
                       std::vector<string>* out) {
  google::protobuf::SourceLocation location;
  if (!desc->GetSourceLocation(&location)) {
    return;
  }
  if (type == COMMENTTYPE_LEADING || type == COMMENTTYPE_TRAILING) {
    const string& comments = type == COMMENTTYPE_LEADING
                                       ? location.leading_comments
                                       : location.trailing_comments;
    Split(comments, '\n', out);
  } else if (type == COMMENTTYPE_LEADING_DETACHED) {
    for (unsigned int i = 0; i < location.leading_detached_comments.size();
         i++) {
      Split(location.leading_detached_comments[i], '\n', out);
      out->push_back("");
    }
  } else {
    std::cerr << "Unknown comment type " << type << std::endl;
    abort();
  }
}

// Each raw comment line without newline is appended to out.
// For file level leading and detached leading comments, we return comments
// above syntax line. Return nothing for trailing comments.
template <>
inline void GetComment(const google::protobuf::FileDescriptor* desc,
                       CommentType type, std::vector<string>* out) {
  if (type == COMMENTTYPE_TRAILING) {
    return;
  }
  google::protobuf::SourceLocation location;
  std::vector<int> path;
  path.push_back(google::protobuf::FileDescriptorProto::kSyntaxFieldNumber);
  if (!desc->GetSourceLocation(path, &location)) {
    return;
  }
  if (type == COMMENTTYPE_LEADING) {
    Split(location.leading_comments, '\n', out);
  } else if (type == COMMENTTYPE_LEADING_DETACHED) {
    for (unsigned int i = 0; i < location.leading_detached_comments.size();
         i++) {
      Split(location.leading_detached_comments[i], '\n', out);
      out->push_back("");
    }
  } else {
    std::cerr << "Unknown comment type " << type << std::endl;
    abort();
  }
}

// Add prefix and newline to each comment line and concatenate them together.
// Make sure there is a space after the prefix unless the line is empty.
inline string GenerateCommentsWithPrefix(
    const std::vector<string>& in, const string& prefix) {
  std::ostringstream oss;
  for (auto it = in.begin(); it != in.end(); it++) {
    const string& elem = *it;
    if (elem.empty()) {
      oss << prefix << "\n";
    } else if (elem[0] == ' ') {
      oss << prefix << elem << "\n";
    } else {
      oss << prefix << " " << elem << "\n";
    }
  }
  return oss.str();
}

template <typename DescriptorType>
inline string GetPrefixedComments(const DescriptorType* desc,
                                        bool leading,
                                        const string& prefix) {
  std::vector<string> out;
  if (leading) {
    GetComment(
        desc, COMMENTTYPE_LEADING_DETACHED, &out);
    std::vector<string> leading;
    GetComment(desc, COMMENTTYPE_LEADING,
                               &leading);
    out.insert(out.end(), leading.begin(), leading.end());
  } else {
    GetComment(desc, COMMENTTYPE_TRAILING,
                               &out);
  }
  return GenerateCommentsWithPrefix(out, prefix);
}

inline string GetJSServiceFilename(const string& filename) {
  return StripProto(filename) + "_rsocket_pb.js";
}

// Get leading or trailing comments in a string. Comment lines start with "// ".
// Leading detached comments are put in in front of leading comments.
template <typename DescriptorType>
inline string GetNodeComments(const DescriptorType* desc, bool leading) {
  return GetPrefixedComments(desc, leading, "//");
}

}  // namespace rsocket_rpc_js_generator

#endif  // RSOCKET_RPC_COMPILER_JS_GENERATOR_HELPERS_H
