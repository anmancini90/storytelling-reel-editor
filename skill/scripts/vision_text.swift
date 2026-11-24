// On-screen text from Apple Vision (VNRecognizeTextRequest, accurate), built into macOS 10.15+, on-device.
// Usage: vision_text @<list.txt>   (one frame path per line)   or   vision_text <frame.jpg>...
// Prints one JSON line per frame: {"f": "<path>", "w": W, "h": H, "t": [["text", confidence, x, y, w, h], ...]}
// x, y = the text line's top-left corner and w, h its size, in the frame's own pixels.
// Compiled and cached by reference.py; without it, on-screen text simply isn't measured.
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 2 else { FileHandle.standardError.write("usage: vision_text @list | frames...\n".data(using: .utf8)!); exit(2) }
let paths: [String] = args[1].hasPrefix("@")
    ? ((try? String(contentsOfFile: String(args[1].dropFirst()), encoding: .utf8)) ?? "").split(separator: "\n").map(String.init)
    : Array(args.dropFirst(1))
var failed = 0
for path in paths {
    guard let img = CIImage(contentsOf: URL(fileURLWithPath: path)) else { failed += 1; continue }
    let W = Double(img.extent.width), H = Double(img.extent.height)
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    do { try VNImageRequestHandler(ciImage: img, options: [:]).perform([req]) } catch { failed += 1; continue }
    var items: [[Any]] = []
    for obs in req.results ?? [] {
        guard let c = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox            // normalised, origin bottom-left
        items.append([c.string, Double(c.confidence), Double(b.minX) * W, (1 - Double(b.maxY)) * H, Double(b.width) * W, Double(b.height) * H])
    }
    let obj: [String: Any] = ["f": path, "w": W, "h": H, "t": items]
    if let data = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: data, encoding: .utf8) { print(s) }
}
if failed > 0 { FileHandle.standardError.write("vision_text: \(failed) of \(paths.count) frames failed\n".data(using: .utf8)!); exit(1) }
