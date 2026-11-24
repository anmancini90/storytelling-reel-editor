// Person masks from Apple Vision (VNGeneratePersonSegmentationRequest, accurate), built into macOS 12+, on-device.
// Usage: vision_seg <out_dir> @<list.txt>     (one frame path per line)  or  vision_seg <out_dir> <frame.jpg>...
// Writes <out_dir>/<frame name>.png: 8-bit grayscale mask at the frame's own size (255 = person).
// Compiled and cached by seg.py; cutout.py and heads.py fall back to u2net when this can't build or run.
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else { FileHandle.standardError.write("usage: vision_seg <out_dir> @list | frames...\n".data(using: .utf8)!); exit(2) }
let outDir = URL(fileURLWithPath: args[1])
let paths: [String] = args[2].hasPrefix("@")
    ? ((try? String(contentsOfFile: String(args[2].dropFirst()), encoding: .utf8)) ?? "").split(separator: "\n").map(String.init)
    : Array(args.dropFirst(2))
let ctx = CIContext()
let gray = CGColorSpaceCreateDeviceGray()
var failed = 0
for path in paths {
    let url = URL(fileURLWithPath: path)
    guard let img = CIImage(contentsOf: url) else { failed += 1; continue }
    let req = VNGeneratePersonSegmentationRequest()
    req.qualityLevel = .accurate
    req.outputPixelFormat = kCVPixelFormatType_OneComponent8
    do { try VNImageRequestHandler(ciImage: img, options: [:]).perform([req]) } catch { failed += 1; continue }
    guard let buf = req.results?.first?.pixelBuffer else { failed += 1; continue }
    var m = CIImage(cvPixelBuffer: buf)
    m = m.transformed(by: CGAffineTransform(scaleX: img.extent.width / m.extent.width, y: img.extent.height / m.extent.height))
    let dst = outDir.appendingPathComponent(url.deletingPathExtension().lastPathComponent + ".png")
    do { try ctx.writePNGRepresentation(of: m, to: dst, format: .L8, colorSpace: gray) } catch { failed += 1 }
}
if failed > 0 { FileHandle.standardError.write("vision_seg: \(failed) of \(paths.count) frames failed\n".data(using: .utf8)!); exit(1) }
