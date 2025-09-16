from __future__ import annotations
from typing import Any, Dict

SpendPolicyLLMSchema: Dict[str, Any] = {
  "type": "object",
  "required": ["spend_policy", "ui"],
  "properties": {
    "spend_policy": {
      "type": "object",
      "required": ["tiers", "constraints", "evidence"],
      "properties": {
        "tiers": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["name", "range", "requires"],
            "properties": {
              "name": { "type": "string" },
              "range": {
                "type": "object",
                "required": ["min", "max"],
                "properties": {
                  "min": { "type": ["number", "null"] },
                  "max": { "type": ["number", "string", "null"] }  # allow "inf"
                }
              },
              "requires": { "type": "array", "items": { "type": "string" } }
            }
          }
        },
        "constraints": { "type": "array", "items": { "type": "object" } },
        "evidence": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["key", "snippet"],
            "properties": { "key": {"type":"string"}, "snippet":{"type":"string"} }
          }
        }
      }
    },
    "ui": {
      "type": "object",
      "required": ["panels"],
      "properties": {
        "panels": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["name", "title", "widgets"],
            "properties": {
              "name":  { "type": "string" },
              "title": { "type": "string" },
              "widgets": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["type", "label", "path"],
                  "properties": {
                    "type": { "type": "string" },     
                    "label": { "type": "string" },
                    "path":  { "type": "string" },    
                    "options": { "type": "array", "items": {"type": "string"} },
                    "optionsPath": { "type": "string" },  
                    "readOnly": { "type": "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
